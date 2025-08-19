/**
 * @file taipower-adapters.ts
 * @description 台電開放資料 API 適配器，負責將原始發電機組資料轉換為標準化格式
 * @author natsuki221
 * @version 2.1.0
 */

import {
  TaipowerRawData,
  PowerGenerationSnapshot,
  UnitData,
} from "./taipower-types";

/**
 * 安全地將台電 API 返回的數值字串轉換為數字
 *
 * 處理台電 API 中常見的無效值標記（如 "-"、"N/A"）和包含括號的註解資訊
 *
 * @param {string} value - 來自台電 API 的原始數值字串
 * @returns {number | null} 轉換後的數字，無法轉換時返回 null
 *
 * @example
 * ```typescript
 * parseNumericValue("123.45")     // 返回: 123.45
 * parseNumericValue("-")          // 返回: null
 * parseNumericValue("100(測試)")  // 返回: 100
 * ```
 */
const parseNumericValue = (value: string): number | null => {
  // 檢查輸入值是否為有效字串及常見無效標記
  if (
    typeof value !== "string" ||
    value.trim() === "-" ||
    value.trim() === "N/A" ||
    value.trim() === ""
  ) {
    return null;
  }

  try {
    // 移除括號內的註解資訊並清理空白字符
    const cleanedValue = value.replace(/\(.*?\)/g, "").trim();
    const number = parseFloat(cleanedValue);
    return isNaN(number) ? null : number;
  } catch (error) {
    console.warn(`無法解析數值: "${value}"`, error);
    return null;
  }
};

/**
 * 台電 API 原始資料適配器
 *
 * 將從台電開放資料平台獲取的發電機組即時資料轉換為統一的 PowerGenerationSnapshot 格式，
 * 便於後續資料分析和儲存至 MongoDB 時間序列集合
 *
 * @param {TaipowerRawData} rawData - 從台電 API 獲取的原始 JSON 資料
 * @returns {PowerGenerationSnapshot} 轉換後的標準化發電快照資料
 * @throws {Error} 當 DateTime 欄位無效或缺失時拋出錯誤
 * @throws {Error} 當日期時間無法正確解析時拋出錯誤
 *
 * @example
 * ```typescript
 * const rawData = await fetch('taipower-api-url').then(res => res.json());
 * const snapshot = taipowerApiAdapter(rawData);
 * console.log(`處理了 ${snapshot.units.length} 個發電機組`);
 * ```
 */
export function taipowerApiAdapter(
  rawData: TaipowerRawData
): PowerGenerationSnapshot {
  // 驗證必要的 DateTime 欄位
  if (!rawData.DateTime || typeof rawData.DateTime !== "string") {
    throw new Error("台電 API 資料中缺少有效的 DateTime 欄位");
  }

  // 將台電提供的時間字串轉換為 UTC Date 物件
  // 台電 API 提供的時間格式通常為 ISO 8601，添加 'Z' 確保解析為 UTC
  const DateTime = new Date(`${rawData.DateTime}Z`);

  if (isNaN(DateTime.getTime())) {
    throw new Error(`無法解析台電 API 提供的時間格式: "${rawData.DateTime}"`);
  }

  // 驗證原始資料結構
  if (!rawData.aaData || !Array.isArray(rawData.aaData)) {
    throw new Error("台電 API 資料中缺少有效的 aaData 陣列");
  }

  const units: UnitData[] = [];

  // 遍歷所有機組資料並進行轉換
  for (const item of rawData.aaData) {
    // 跳過無效記錄和小計行
    if (
      !item["機組名稱"] ||
      item["機組名稱"].includes("小計") ||
      item["機組名稱"].includes("合計")
    ) {
      continue;
    }

    try {
      const unitData: UnitData = {
        unitType: item["機組類型"] || "未知",
        unitName: item["機組名稱"],
        installedCapacityMW: parseNumericValue(item["裝置容量(MW)"]),
        netGenerationMW: parseNumericValue(item["淨發電量(MW)"]),
        note: (item["備註"] || "").trim(),
      };

      units.push(unitData);
    } catch (error) {
      console.warn(`處理機組資料時發生錯誤: ${item["機組名稱"]}`, error);
      // 繼續處理其他機組，不因單一機組錯誤而中斷整個轉換過程
      continue;
    }
  }

  // 建立最終的快照物件
  const snapshot: PowerGenerationSnapshot = {
    DateTime,
    metadata: {
      source: "taipower-opendata",
    },
    units,
  };

  console.log(
    `台電資料適配完成: ${units.length} 個機組，時間: ${DateTime.toISOString()}`
  );
  return snapshot;
}
