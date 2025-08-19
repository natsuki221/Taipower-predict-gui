/**
 * @file data-checker.ts
 * @description 資料存在性檢查工具，用於預防重複資料寫入
 * @author natsuki221
 * @version 2.0.0
 */

import { connectToDatabase } from "./mongodb";
import { Collection, Document } from "mongodb";
import { logger } from "./logger";

/**
 * 資料檢查結果介面
 */
export interface DataCheckResult {
  exists: boolean;
  error?: string;
  performance?: {
    queryTime: number;
    indexUsed: boolean;
  };
}

/**
 * 檢查指定集合中是否已存在相同 DateTime 的文件
 *
 * 此函式旨在防止重複資料寫入，提供了加強的錯誤處理和性能監控
 *
 * 建議在 MongoDB 中為 DateTime 欄位建立索引以提升查詢效率：
 * ```javascript
 * db.your_collection.createIndex({ "DateTime": 1 })
 * ```
 *
 * @param {string} collectionName - 要檢查的集合名稱
 * @param {string | Date} dateTime - 要檢查的時間值，可為 ISO 8601 字串或 Date 物件
 * @returns {Promise<DataCheckResult>} 檢查結果包含存在性和性能資訊
 *
 * @example
 * ```typescript
 * const result = await documentExists('weather-snapshots', '2024-01-01T00:00:00Z');
 * if (result.exists) {
 *   console.log('資料已存在，跳過寫入');
 * }
 * ```
 */
export const documentExists = async (
  collectionName: string,
  dateTime: string | Date
): Promise<DataCheckResult> => {
  const startTime = Date.now();

  try {
    // 檢查輸入參數
    if (!collectionName || typeof collectionName !== "string") {
      throw new Error("無效的集合名稱");
    }

    if (!dateTime) {
      throw new Error("無效的日期時間參數");
    }

    // 連接資料庫
    const { db } = await connectToDatabase();
    const collection: Collection<Document> = db.collection(collectionName);

    // 正規化時間值 - 支援 Date 物件和字串
    const normalizedDateTime =
      typeof dateTime === "string" ? new Date(dateTime) : dateTime;

    if (isNaN(normalizedDateTime.getTime())) {
      throw new Error(`無法解析的日期格式: ${dateTime}`);
    }

    // 使用 findOne 而非 countDocuments 以提升效率
    // findOne 在找到第一個匹配文件後就停止
    const existingDoc = await collection.findOne(
      { DateTime: normalizedDateTime },
      { projection: { _id: 1 } } // 只返回 _id 欄位減少網路傳輸
    );

    const queryTime = Date.now() - startTime;

    // 性能監控：如果查詢時間超過 100ms，建議檢查索引
    if (queryTime > 100) {
      // console.warn(
      //   `⚠️  ${collectionName} 集合的 DateTime 查詢耗時 ${queryTime}ms，建議建立索引`
      // );
      logger.warn(
        `[Data Checker] ⚠️  ${collectionName} 集合的 DateTime 查詢耗時 ${queryTime}ms，建議建立索引`
      );
    }

    return {
      exists: !!existingDoc,
      performance: {
        queryTime,
        indexUsed: queryTime < 50, // 簡單的索引使用判斷
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // console.error(
    //   `❌ 在 ${collectionName} 中檢查文件時發生錯誤:`,
    //   errorMessage
    // );
    logger.error(
      `[Data Checker] ❌ 在 ${collectionName} 中檢查文件時發生錯誤:`,
      errorMessage
    );

    // 回傳錯誤詳情但保守的預設值
    return {
      exists: true, // 為了安全起見，假設文件已存在以避免重複寫入
      error: errorMessage,
      performance: {
        queryTime: Date.now() - startTime,
        indexUsed: false,
      },
    };
  }
};

/**
 * 批量檢查多個時間點的資料是否存在
 *
 * @param {string} collectionName - 集合名稱
 * @param {(string | Date)[]} dateTimes - 要檢查的時間點陣列
 * @returns {Promise<Map<string, boolean>>} 時間點對應的存在性映射
 */
export const batchDocumentExists = async (
  collectionName: string,
  dateTimes: (string | Date)[]
): Promise<Map<string, boolean>> => {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection(collectionName);

    // 正規化所有時間值
    const normalizedTimes = dateTimes.map((dt) =>
      typeof dt === "string" ? new Date(dt) : dt
    );

    // 使用 $in 操作子一次查詢多個時間點
    const existingDocs = await collection
      .find(
        { DateTime: { $in: normalizedTimes } },
        { projection: { DateTime: 1 } }
      )
      .toArray();

    // 建立結果映射
    const result = new Map<string, boolean>();
    const existingTimeSet = new Set(
      existingDocs.map((doc) => new Date(doc.DateTime).getTime())
    );

    dateTimes.forEach((dt, index) => {
      const normalizedTime = normalizedTimes[index];
      const timeKey = typeof dt === "string" ? dt : dt.toISOString();
      result.set(timeKey, existingTimeSet.has(normalizedTime.getTime()));
    });

    return result;
  } catch (error) {
    // console.error(`批量檢查 ${collectionName} 時發生錯誤:`, error);
    logger.error(`[Data Checker] 批量檢查 ${collectionName} 時發生錯誤:`, error);
    // 錯誤時返回空的 Map
    return new Map();
  }
};
