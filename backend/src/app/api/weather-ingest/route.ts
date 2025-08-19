/**
 * @file /src/app/api/weather-ingest/route.ts
 * @description Next.js API 路由，用於從 CWA 擷取天氣資料、轉換並以快照形式存入 MongoDB。
 * @author natsuki221
 * @version 3.0.0
 * @date 2025-08-11
 */

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import {
  CwaApiResponse,
  CwaApiStation,
  WeatherSnapshot,
} from "@/lib/weather-types";
import { adaptCwaDataToSnapshot } from "@/lib/weather-adapter";

// =================================================================
// 1. 常數與設定 (Constants & Configuration)
// =================================================================

// 從環境變數讀取 API 金鑰，驗證在運行時進行
const CWA_API_KEY = process.env.WEATHER_API_KEY;

const STATIONID =
  "C0AH50,C0AK10,467490,C0R260,C0R250,C0R140,C0R150,C0I110,C0I120,C0F0C0,C0F0D0,C0F0E0,C0F0A0,C0K290,C0K280,C0C590,C0C740,C0C750,C0E590,C0E570,C0E920,C0R190,C0R180,C0C620,467050,C0C730,C0K410,467410,C0G650,C0G640,C0G660,C0G670,467480,C0M670,467420,C0M680,C0M690,C0W140,C0W150,C0A860,C0AJ20,467590,C0R690,C0R350,C0R620,C0R710,C0R730,C0R880,C0R890,C0W160,467110,C0W170,467990,C0E791,C0H950,C0H9A0,C0I130,C0I080,C0T9D0,C0T820,C0T9B0,C0TA20,C0TA40,C0TA50,C0TA80,C0A570,C0AH90,C0A530,C0U980,C0C670,C0M700,C0M710,C0M720,C0M730,C0M740,C0S700,C0SA10,C0S890,C0F9K0,C0F9L0,C0F9M0,C0G680,C0G690,C0G700,C0K300,C0K310,C0E420,C0E930,C0F9N0,C0F9O0,C0K320,C0K330,C0M750,C0M760,C0H970,467650";
const WEATHER_ELEMENTS =
  "Weather,WindDirection,WindSpeed,AirTemperature,RelativeHumidity,AirPressure,GustInfo,DailyHigh,DailyLow";
const GEO_INFO = "CountyName,TownName";

// 定義要查詢的兩個 API 資料集 ID
const DATASET_IDS = ["O-A0001-001", "O-A0003-001"];

// MongoDB 集合名稱
const COLLECTION_NAME = "weather-snapshots";

// =================================================================
// 2. 核心擷取與儲存邏輯 (Core Ingestion & Storage Logic)
// =================================================================

/**
 * 執行資料擷取、轉換和儲存的核心函式。
 */
async function ingestWeatherData() {
  console.log("[Weather Ingest] 開始從 CWA API 擷取資料...");

  // 運行時環境變數驗證
  if (!CWA_API_KEY) {
    throw new Error("環境變數 WEATHER_API_KEY 未設定。");
  }

  // 建立 API 請求的 promises 陣列
  const fetchPromises = DATASET_IDS.map((id) => {
    const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/${id}?Authorization=${CWA_API_KEY}&StationId=${STATIONID}&WeatherElement=${WEATHER_ELEMENTS}&GeoInfo=${GEO_INFO}`;
    return fetch(url, { next: { revalidate: 0 } });
  });

  // 平行發送所有請求
  const responses = await Promise.all(fetchPromises);

  // 檢查所有回應是否成功
  for (const response of responses) {
    if (!response.ok) {
      throw new Error(
        `CWA API 請求失敗: ${response.status} ${response.statusText}`
      );
    }
  }

  // 解析所有回應的 JSON
  const apiData: CwaApiResponse<CwaApiStation>[] = await Promise.all(
    responses.map((res) => res.json())
  );

  // 使用適配器將多個 API 回應轉換為單一快照
  const snapshot = adaptCwaDataToSnapshot(apiData);

  if (!snapshot || snapshot.stations.length === 0) {
    const message = "[Weather Ingest] 轉換後無有效測站資料可供儲存。";
    console.log(message);
    return { message, status: 200, insertedCount: 0 };
  }

  console.log(
    `[Weather Ingest] 成功轉換 ${
      snapshot.stations.length
    } 筆測站資料，時間戳記: ${snapshot.timestamp.toISOString()}`
  );

  // 連接到資料庫並存取集合
  const { db } = await connectToDatabase();
  const collection = db.collection<WeatherSnapshot>(COLLECTION_NAME);

  // 檢查具有相同時間戳記的文件是否已存在
  const existingDoc = await collection.findOne({
    timestamp: snapshot.timestamp,
  });

  if (existingDoc) {
    const message = `[Weather Ingest] 偵測到重複的時間戳記 (${snapshot.timestamp.toISOString()})，跳過寫入。`;
    console.log(message);
    return { message, status: 200, insertedCount: 0 };
  }

  // 插入新的快照文件
  const result = await collection.insertOne(snapshot);
  const message = `[Weather Ingest] 成功將天氣快照寫入資料庫，文件 ID: ${result.insertedId}`;
  console.log(message);

  return {
    message,
    insertedId: result.insertedId,
    insertedCount: snapshot.stations.length,
    status: 201,
  };
}

// =================================================================
// 3. API 路由處理器 (API Route Handlers)
// =================================================================

/**
 * GET 請求處理器，主要用於 Vercel Cron Job 或其他排程器自動觸發。
 */
export async function GET() {
  console.log("[Weather Ingest] GET 請求觸發資料擷取...");
  try {
    const result = await ingestWeatherData();
    return NextResponse.json(
      {
        success: true,
        message: result.message,
        insertedId: result.insertedId,
        insertedCount: result.insertedCount,
      },
      { status: result.status }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "發生未知錯誤";
    console.error("[Weather Ingest] 處理 GET 請求時發生嚴重錯誤:", error);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST 請求處理器，方便手動觸發和測試。
 */
export async function POST() {
  console.log("[Weather Ingest] POST 請求 (手動) 觸發資料擷取...");
  try {
    const result = await ingestWeatherData();
    return NextResponse.json(
      {
        success: true,
        message: result.message,
        insertedId: result.insertedId,
        insertedCount: result.insertedCount,
      },
      { status: result.status }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "發生未知錯誤";
    console.error("[Weather Ingest] 處理 POST 請求時發生嚴重錯誤:", error);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
