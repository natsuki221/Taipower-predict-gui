/**
 * @file gereratingUnit-import.ts
 * @description 台電開放資料 API importer，負責將歷史發電機組資料轉換為標準化格式後存入 MongoDB
 * @author natsuki221
 * @version 1.0.0
 */

import fs from "fs/promises";
import path from "path";
import { connectToDatabase } from "../../lib/mongodb";
import { PowerGenerationSnapshot, UnitData } from "../../lib/taipower-types";

const COLLECTION_NAME = "generating-unit-history";
const INSTALLED_CAPACITY_DICT: Record<string, number> = {
  "核三#2": 951.0,
  "林口#1": 800.0,
  "林口#2": 800.0,
  "林口#3": 800.0,
  "台中#1": 550.0,
  "台中#2": 550.0,
  "台中#3": 550.0,
  "台中#4": 550.0,
  "台中#5": 550.0,
  "台中#6": 550.0,
  "台中#7": 550.0,
  "台中#8": 550.0,
  "台中#9": 550.0,
  "台中#10": 550.0,
  "興達#3": 550.0,
  "興達#4": 550.0,
  "大林#1": 800.0,
  "大林#2": 800.0,
  "和平#1": 648.6,
  "和平#2": 660.0,
  "麥寮#1": 600.0,
  "麥寮#3": 600.0,
  "大潭CC#1": 742.7,
  "大潭CC#2": 742.7,
  "大潭CC#3": 724.7,
  "大潭CC#4": 724.7,
  "大潭CC#5": 724.7,
  "大潭CC#6": 724.7,
  "大潭CC#8": 1123.6,
  "通霄CC#1": 892.6,
  "通霄CC#2": 892.6,
  "通霄CC#3": 892.6,
  "通霄CC#6": 321.2,
  "通霄GT#9": 180.9,
  "興達CC#1": 445.2,
  "興達CC#2": 445.2,
  "興達CC#3": 445.2,
  "興達CC#4": 445.2,
  "興達CC#5": 445.2,
  "南部CC#1": 288.8,
  "南部CC#2": 288.8,
  "南部CC#3": 288.8,
  "南部CC#4": 251.4,
  "大林#6": 550.0,
  "協和#3": 500.0,
  "協和#4": 500.0,
  "台中Gas1&2": 140.0,
  "台中Gas3&4": 140.0,
  "大觀二#1": 250.0,
  "大觀二#2": 250.0,
  "大觀二#3": 250.0,
  "大觀二#4": 250.0,
  "明潭#1": 267.0,
  "明潭#2": 267.0,
  "明潭#3": 267.0,
  "明潭#4": 267.0,
  "明潭#5": 267.0,
  "明潭#6": 267.0,
};

// =================================================================
// 1. 設定要匯入的舊資料檔案列表
// =================================================================
// 將您的舊 JSON 檔案路徑放在這裡。
const HISTORICAL_FILES: string = "../dev/GeneratingUnit/HistGeratingUnit.json";

/**
 * 特製的 Adapter，專門用於處理歷史資料。
 * @param jsonData - 從檔案讀取的 CSV 字串。
 * @returns 轉換後的 PowerGenerationSnapshot 物件陣列。
 */
// TODO: 完成 Adapter 函數
// const historicalDataAdapter = (
//   DateTime: string,
//   metadata: { source: string },
//   units: UnitData[]
// ): PowerGenerationSnapshot[] => {};

/**
 * 主執行函數
 */
async function importHistoricalData() {
  console.log("--- 開始匯入歷史備轉容量資料 ---");

  try {
    const allRecordsToInsert: PowerGenerationSnapshot[] = [];

    // TODO : 2. 讀取並轉換所有檔案

    if (allRecordsToInsert.length === 0) {
      console.log("沒有找到任何可匯入的紀錄。腳本執行完畢。");
      return;
    }
    console.log(
      `\n總共轉換了 ${allRecordsToInsert.length} 筆紀錄，準備寫入資料庫...`
    );

    // 3. 連接資料庫並寫入資料
    const { db } = await connectToDatabase();
    const collection = db.collection<PowerGenerationSnapshot>(COLLECTION_NAME);

    // TODO: 4. 依照時序排序資料

    // TODO: 5. 批次插入新資料
  } catch (error) {
    console.error("\n匯入過程中發生錯誤:", error);
  } finally {
    console.log("--- 歷史資料匯入腳本執行完畢 ---");
  }
}

// 執行腳本
importHistoricalData();
console.log("--- 歷史資料匯入腳本執行完畢 ---");
