import fs from "fs/promises";
import path from "path";
import { connectToDatabase } from "../../lib/mongodb"; // 確保路徑正確
import { ReserveType } from "../../lib/reserve-type"; // 確保路徑正確

const COLLECTION_NAME = "reserve-doc-history";

// =================================================================
// 1. 設定要匯入的舊資料檔案列表
// =================================================================
// 將您的舊 CSV 檔案路徑放在這裡。
// 腳本會從檔名中自動解析年份 (例如 'reserve2023.csv' -> 2023)`
const HISTORICAL_FILES: string[] = [
  "./dev/OperatingReserveData/reserve2018.csv",
  "./dev/OperatingReserveData/reserve2019.csv",
  "./dev/OperatingReserveData/reserve2020.csv",
  "./dev/OperatingReserveData/reserve2021.csv",
  "./dev/OperatingReserveData/reserve2022.csv",
  "./dev/OperatingReserveData/reserve2023.csv",
  "./dev/OperatingReserveData/reserve2024.csv",
];

/**
 * 特製的 Adapter，專門用於處理歷史資料。
 * @param csvData - 從檔案讀取的 CSV 字串。
 * @param year - 從檔名解析出來的年份。
 * @returns 轉換後的 ReserveType 物件陣列。
 */
const historicalDataAdapter = (
  csvData: string,
  year: number
): ReserveType[] => {
  const rows = csvData.trim().split("\n");
  const results = rows.map((row) => {
    if (!row || !row.includes(",")) return null;

    const [dateStr, peakLoad, reserveCapacity, reservePercentage] =
      row.split(",");
    if (!dateStr || !dateStr.includes("/")) return null;

    const [month, day] = dateStr.split("/");
    if (!month || !day) return null;

    const datePart = `${year}-${month.padStart(2, "0")}-${day.padStart(
      2,
      "0"
    )}`;
    const timePart = "T00:00:00.000+08:00";
    const dateObject = new Date(datePart + timePart);

    return {
      DateTime: dateObject,
      "瞬時尖峰負載(萬瓩)": parseFloat(peakLoad) || null,
      "備轉容量(萬瓩)": parseFloat(reserveCapacity) || null,
      "備轉容量率(%)": parseFloat(reservePercentage) || null,
    };
  });
  return results.filter((item): item is ReserveType => item !== null);
};

/**
 * 主執行函數
 */
async function importHistoricalData() {
  console.log("--- 開始匯入歷史備轉容量資料 ---");

  try {
    const allRecordsToInsert: ReserveType[] = [];

    // 2. 讀取並轉換所有檔案
    for (const filePath of HISTORICAL_FILES) {
      console.log(`正在處理檔案: ${filePath}...`);

      const yearMatch = filePath.match(/reserve(\d{4})\.csv$/);
      if (!yearMatch) {
        console.warn(`警告：無法從檔名 ${filePath} 解析年份，已跳過。`);
        continue;
      }
      const year = parseInt(yearMatch[1], 10);

      const fullPath = path.resolve(process.cwd(), filePath);
      const csvData = await fs.readFile(fullPath, "utf-8");

      const adaptedData = historicalDataAdapter(csvData, year);
      allRecordsToInsert.push(...adaptedData);
      console.log(
        `  -> 從 ${year} 年的資料中成功轉換 ${adaptedData.length} 筆紀錄。`
      );
    }

    if (allRecordsToInsert.length === 0) {
      console.log("沒有找到任何可匯入的紀錄。腳本執行完畢。");
      return;
    }
    console.log(
      `\n總共轉換了 ${allRecordsToInsert.length} 筆紀錄，準備寫入資料庫...`
    );

    // 3. 連接資料庫並寫入資料
    const { db } = await connectToDatabase();
    const collection = db.collection<ReserveType>(COLLECTION_NAME);

    // 4. 高效檢查重複資料
    const dateTimesFromSource = allRecordsToInsert.map((r) => r.DateTime);
    const existingRecords = await collection
      .find({ DateTime: { $in: dateTimesFromSource } })
      .project({ DateTime: 1, _id: 0 })
      .toArray();

    const existingDatesSet = new Set(
      existingRecords.map((r) => r.DateTime.getTime())
    );
    const newRecords = allRecordsToInsert.filter(
      (r) => !existingDatesSet.has(r.DateTime.getTime())
    );

    // 5. 批次插入新資料
    if (newRecords.length > 0) {
      await collection.insertMany(newRecords);
      console.log(
        `\n成功！已將 ${newRecords.length} 筆新紀錄匯入到 '${COLLECTION_NAME}' 集合中。`
      );
      console.log(
        `（${
          allRecordsToInsert.length - newRecords.length
        } 筆紀錄因重複而跳過）`
      );
    } else {
      console.log("\n所有紀錄皆已存在於資料庫中，無需新增。");
    }
  } catch (error) {
    console.error("\n匯入過程中發生錯誤:", error);
  } finally {
    console.log("--- 歷史資料匯入腳本執行完畢 ---");
  }
}

// 執行腳本
importHistoricalData();
console.log("--- 歷史資料匯入腳本執行完畢 ---");

// 執行腳本
importHistoricalData();
