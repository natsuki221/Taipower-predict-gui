/**
 * @file /api/weather-ingest/route.ts
 * @description Next.js API 路由，用於從 CWA 擷取天氣資料並存入 MongoDB。
 * @author Aston Lin (linnatsuki221@gmail.com)
 * @version 2.4.1
 * @date 2025-08-11
 * @changes 添加 POST 方法支援，方便手動觸發
 */

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { CwaApiResponse, ProcessedWeatherData } from "@/lib/weather-types";
import { adaptCwaRecordsToProcessedData } from "@/lib/weather-adapter";

// =================================================================
// 1. 常數定義 (Constants)
// =================================================================

const CWA_STATION_IDS =
  "C0AH50,C0AK10,467490,C0R260,C0R250,C0R140,C0R150,C0I110,C0I120,C0F0C0,C0F0D0,C0F0E0,C0F0A0,C0K290,C0K280,C0C590,C0C740,C0C750,C0E590,C0E570,C0E920,C0R190,C0R180,C0C620,467050,C0C730,C0K410,467410,C0G650,C0G640,C0G660,C0G670,467480,C0M670,467420,C0M680,C0M690,C0W140,C0W150,C0A860,C0AJ20,467590,C0R690,C0R350,C0R620,C0R710,C0R730,C0R880,C0R890,C0W160,467110,C0W170,467990,C0E791,C0H950,C0H9A0,C0I130,C0I080,C0T9D0,C0T820,C0T9B0,C0TA20,C0TA40,C0TA50,C0TA80,C0A570,C0AH90,C0A530,C0U980,C0C670,C0M700,C0M710,C0M720,C0M730,C0M740,C0S700,C0SA10,C0S890,C0F9K0,C0F9L0,C0F9M0,C0G680,C0G690,C0G700,C0K300,C0K310,C0E420,C0E930,C0F9N0,C0F9O0,C0K320,C0K330,C0M750,C0M760,C0H970,467650";

const WEATHER_ELEMENTS =
  "Weather,WindDirection,WindSpeed,AirTemperature,RelativeHumidity,AirPressure,GustInfo,DailyExtreme";
const GEO_INFO = "CountyName,TownName";

const CWA_API_URL = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0001-001?Authorization=${process.env.WEATHER_API_KEY}&StationID=${CWA_STATION_IDS}&WeatherElement=${WEATHER_ELEMENTS}&GeoInfo=${GEO_INFO}`;

const COLLECTION_NAME = "weather-observations";

// =================================================================
// 2. 核心邏輯 (Core Logic)
// =================================================================

async function ingestWeatherData() {
  console.log("Fetching data from CWA API...");
  const response = await fetch(CWA_API_URL, { next: { revalidate: 0 } });
  if (!response.ok) {
    throw new Error(`CWA API fetch failed: ${response.statusText}`);
  }
  const data: CwaApiResponse = await response.json();

  if (
    data.success !== "true" ||
    !data.records ||
    !Array.isArray(data.records.Station)
  ) {
    throw new Error("Invalid or empty data received from CWA API.");
  }

  const processedRecords = adaptCwaRecordsToProcessedData(data.records.Station);

  if (processedRecords.length === 0) {
    console.log("No valid station data to process.");
    return {
      message: "No valid station data to process.",
      status: 200,
      insertedCount: 0,
    };
  }
  console.log(
    `Adapted ${processedRecords.length} records for database insertion.`
  );

  const { db } = await connectToDatabase();
  const collection = db.collection<ProcessedWeatherData>(COLLECTION_NAME);

  // 確保時序集合存在 (僅在首次執行時建立)
  const collections = await db
    .listCollections({ name: COLLECTION_NAME })
    .toArray();
  if (collections.length === 0) {
    console.log(
      `Collection '${COLLECTION_NAME}' not found. Creating timeseries collection...`
    );
    await db.createCollection(COLLECTION_NAME, {
      timeseries: {
        timeField: "dateTime", // 正確的時間欄位
        metaField: "stationId", // 正確的元數據欄位
        granularity: "minutes",
      },
    });
    console.log(
      `Successfully created timeseries collection: ${COLLECTION_NAME}`
    );
  }

  // 批次寫入資料
  try {
    const result = await collection.insertMany(processedRecords, {
      ordered: false,
    });
    const message = `Successfully inserted ${result.insertedCount} new weather records.`;
    console.log(message);
    return {
      message,
      insertedCount: result.insertedCount,
      status: 201,
    };
  } catch (error: unknown) {
    // Use type guards to safely access error properties
    if (
      typeof error === "object" &&
      error !== null &&
      ("code" in error || "writeErrors" in error)
    ) {
      const code = (error as { code?: number }).code;
      const writeErrors = (error as { writeErrors?: { code?: number }[] })
        .writeErrors;
      if (
        code === 11000 ||
        (Array.isArray(writeErrors) &&
          writeErrors.some((e) => e.code === 11000))
      ) {
        const insertedCount =
          (error as { result?: { nInserted?: number } }).result?.nInserted || 0;
        const message = `Bulk write completed. Some duplicates were skipped. Inserted ${insertedCount} new records.`;
        console.log(message);
        return { message, insertedCount, status: 200 };
      }
    }
    // 向上拋出其他類型的寫入錯誤
    console.error("A non-duplicate-key bulk write error occurred:", error);
    throw error;
  }
}

// =================================================================
// 3. API 路由處理器 (API Route Handlers)
// =================================================================

/**
 * GET 處理器 - 主要用於排程器自動觸發
 */
export async function GET() {
  console.log("Weather data ingestion process started via GET.");
  try {
    const result = await ingestWeatherData();
    return NextResponse.json(
      { message: result.message, insertedCount: result.insertedCount },
      { status: result.status }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Weather data ingestion process failed:", error);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST 處理器 - 方便手動觸發和測試
 */
export async function POST() {
  console.log(
    "Weather data ingestion process started via POST (manual trigger)."
  );
  try {
    const result = await ingestWeatherData();
    return NextResponse.json(
      {
        message: result.message,
        insertedCount: result.insertedCount,
        method: "POST",
        triggered: "manually",
      },
      { status: result.status }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error("Weather data ingestion process failed:", error);
    return NextResponse.json(
      { success: false, error: errorMessage, method: "POST" },
      { status: 500 }
    );
  }
}
