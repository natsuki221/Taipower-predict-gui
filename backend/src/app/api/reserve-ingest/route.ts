import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { reserveAdapter } from "@/lib/reserve-adapter";
import { ReserveType } from "@/lib/reserve-type";

const COLLECTION_NAME = "reserve-doc";

/**
 * 核心資料擷取與儲存邏輯。
 * 此函數現在被設計為可由外部（如排程器）導入和調用。
 * @returns 一個包含操作結果的物件
 */
export async function ingestData() {
  console.log("[IngestJob] 開始執行 reserve-ingest 任務...");
  // 1. 從外部 API 獲取並轉換資料
  const apiUrl = process.env.RESERVE_API_URL;
  if (!apiUrl) {
    console.error("錯誤：環境變數 RESERVE_API_URL 未設定。");
    throw new Error("伺服器設定不完整：RESERVE_API_URL 未設定。");
  }

  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`無法從來源獲取資料，狀態碼: ${response.status}`);
  }

  const csvData = await response.text();
  const adaptedData = reserveAdapter(csvData);

  if (!adaptedData || adaptedData.length === 0) {
    console.log("[IngestJob] 來源無資料或無需更新。");
    return {
      success: true,
      message: "來源無資料，或資料已是最新，無需處理。",
      insertedCount: 0,
      duplicateCount: 0,
    };
  }

  // 2. 連接資料庫並高效地處理資料插入
  const { db } = await connectToDatabase();
  const collection = db.collection<ReserveType>(COLLECTION_NAME);

  const dateTimesFromSource = adaptedData.map((record) => record.DateTime);

  const existingRecords = await collection
    .find({
      DateTime: { $in: dateTimesFromSource },
    })
    .project({ DateTime: 1, _id: 0 })
    .toArray();

  // 【核心修正】將 Date 物件轉換為毫秒時間戳記 (number) 來進行比較，這樣更可靠。
  const existingDatesSet = new Set(
    existingRecords.map((record) => record.DateTime.getTime())
  );

  // 過濾出資料庫中不存在的新紀錄，同樣使用 getTime() 進行比對。
  const recordsToInsert = adaptedData.filter(
    (record) => !existingDatesSet.has(record.DateTime.getTime())
  );

  if (recordsToInsert.length > 0) {
    await collection.insertMany(recordsToInsert);
  }

  const result = {
    success: true,
    message: "資料擷取與儲存成功。",
    insertedCount: recordsToInsert.length,
    duplicateCount: adaptedData.length - recordsToInsert.length,
    totalSourceRecords: adaptedData.length,
  };
  console.log("[IngestJob] reserve-ingest 任務完成:", result);
  return result;
}

// =================================================================
// API 路由處理器保持不變，用於手動觸發
// =================================================================

export async function GET() {
  try {
    const result = await ingestData();
    return NextResponse.json(result);
  } catch (error) {
    console.error("手動觸發資料擷取過程中發生錯誤:", error);
    const errorMessage =
      error instanceof Error ? error.message : "發生未知錯誤";
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = await ingestData();
    return NextResponse.json(result);
  } catch (error) {
    console.error("手動觸發資料擷取過程中發生錯誤:", error);
    const errorMessage =
      error instanceof Error ? error.message : "發生未知錯誤";
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
