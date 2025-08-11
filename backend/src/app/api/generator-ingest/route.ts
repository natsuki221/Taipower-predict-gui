import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { taipowerApiAdapter } from "@/lib/taipower-adapters";
import { TaipowerRawData } from "@/lib/taipower-types";

const GENERATING_UNITS_DATA = process.env.GENERATING_UNITS_DATA;
const COLLECTION_NAME = "generating-unit";

/**
 * 執行資料擷取與寫入的核心邏輯。
 * 此函式由 GET (用於排程) 和 POST (用於手動觸發) 共享。
 */
async function ingestData() {
  // 1. 檢查環境變數
  if (!GENERATING_UNITS_DATA) {
    throw new Error("環境變數 GENERATING_UNITS_DATA 未設定。");
  }

  // 2. 取得 Taipower API 資料
  const response = await fetch(GENERATING_UNITS_DATA);
  if (!response.ok) {
    throw new Error(`從台電 API 擷取資料失敗: ${response.statusText}`);
  }
  const rawData: TaipowerRawData = await response.json();

  // 3. 使用 adapter 轉換數據
  const transformedData = taipowerApiAdapter(rawData);

  // 4. 連接到 MongoDB
  const { db } = await connectToDatabase();
  const collection = db.collection(COLLECTION_NAME);

  // 5. 整合重複資料檢查
  const count = await collection.countDocuments({
    DateTime: transformedData.DateTime,
  });
  if (count > 0) {
    const message = `偵測到重複的發電資料，將跳過寫入。時間點: ${transformedData.DateTime}`;
    console.log(message);
    return { message, status: 200 }; // 200 OK 表示成功處理，但無操作
  }

  // 6. 檢查並建立 Collection (維持您的原始邏輯)
  const collections = await db
    .listCollections({ name: COLLECTION_NAME })
    .toArray();
  if (collections.length === 0) {
    await db.createCollection(COLLECTION_NAME, {
      timeseries: {
        timeField: "DateTime",
        metaField: "metadata",
        granularity: "minutes",
      },
    });
    console.log(`成功建立時間序列集合: ${COLLECTION_NAME}`);
  }

  // 7. 寫入資料
  if (transformedData.units.length === 0) {
    return { message: "沒有有效的機組資料可供寫入。", status: 400 };
  }

  const result = await collection.insertOne(transformedData);
  return {
    message: "資料快照成功寫入！",
    insertedId: result.insertedId,
    status: 201,
  };
}

/**
 * GET 請求處理器，供排程呼叫。
 */
export async function GET() {
  console.log("發電資料擷取排程已啟動。");
  try {
    const result = await ingestData();
    return NextResponse.json(
      { message: result.message, insertedId: result.insertedId },
      { status: result.status }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("發電資料擷取排程發生錯誤:", errorMessage);
    return NextResponse.json(
      { message: "發電資料擷取排程發生錯誤", error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST 請求處理器，供手動觸發。
 */
export async function POST() {
  console.log("手動觸發發電資料擷取。");
  try {
    const result = await ingestData();
    return NextResponse.json(
      { message: result.message, insertedId: result.insertedId },
      { status: result.status }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to ingest Taipower data:", error);
    return NextResponse.json(
      { message: "Failed to ingest Taipower data", error: errorMessage },
      { status: 500 }
    );
  }
}
