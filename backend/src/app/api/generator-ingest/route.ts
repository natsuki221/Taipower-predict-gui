import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { taipowerApiAdapter } from "@/lib/taipower-adapter";
import { TaipowerRawData } from "@/lib/taipower-types";

const TAIPOWER_API_URL = process.env.GENERATING_UNITS_DATA;
const COLLECTION_NAME = "generating-unit";

export async function POST() {
  if (!TAIPOWER_API_URL) {
    return NextResponse.json(
      { message: "GENERATING_UNITS_DATA environment variable not set" },
      { status: 500 }
    );
  }

  // 取得 Taipower API 資料
  try {
    const response = await fetch(TAIPOWER_API_URL);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch data from Taipower API: ${response.statusText}`
      );
    }
    const rawData: TaipowerRawData = await response.json();

    // 測試是否fetch成功
    //console.log("Raw data fetched successfully:", rawData);

    // 連接到 MongoDB 資料庫
    const { db } = await connectToDatabase();

    const collections = await db
      .listCollections({ name: COLLECTION_NAME })
      .toArray();

    // 檢查是否已存在指定的集合
    if (collections.length === 0) {
      await db.createCollection(COLLECTION_NAME, {
        timeseries: {
          timeField: "DateTime",
          metaField: "metadata",
          granularity: "minutes",
        },
      });
      console.log(
        `Successfully created time series collection: ${COLLECTION_NAME}`
      );
    }

    // 使用 Taipower API adapter轉換數據
    const transformedData = taipowerApiAdapter(rawData);

    // 測試轉換後的數據
    //console.log("Transformed data:", transformedData);

    if (transformedData.units.length === 0) {
      return NextResponse.json(
        { message: "No valid unit data to insert." },
        { status: 400 }
      );
    }

    const collection = db.collection(COLLECTION_NAME);
    const result = await collection.insertOne(transformedData);

    return NextResponse.json(
      {
        message: "Data snapshot ingested successfully!",
        insertedId: result.insertedId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to ingest Taipower data:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { message: "Failed to ingest Taipower data", error: errorMessage },
      { status: 500 }
    );
  }
}
