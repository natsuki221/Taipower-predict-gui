/**
 * @file mongodb.ts
 * @description MongoDB 資料庫連線管理模組，使用單例模式確保連線效率
 * @author natsuki221
 * @version 2.0.0
 */

import { MongoClient, Db } from "mongodb";

/**
 * MongoDB 連線 URI，優先使用本地開發環境，生產環境使用伺服器 URL
 */
const MONGODB_URI: string | undefined =
  process.env.DB_LOCAL_URL || process.env.DB_SERVER_URL;

/**
 * MongoDB 資料庫名稱
 */
const MONGODB_DB_NAME: string | undefined = process.env.DB_NAME;

// 延遲環境變數驗證，避免在構建時拋出錯誤

/**
 * 快取的 MongoDB 客戶端實例，避免重複建立連線
 */
let cachedClient: MongoClient | null = null;

/**
 * 快取的資料庫實例
 */
let cachedDb: Db | null = null;

/**
 * 資料庫連線結果介面
 */
export interface DatabaseConnection {
  client: MongoClient;
  db: Db;
}

/**
 * 建立或取得快取的 MongoDB 資料庫連線
 *
 * 使用單例模式確保在 Next.js 開發環境的熱重載過程中，
 * 不會建立過多的資料庫連線，提升開發效率並避免連線池耗盡
 *
 * @returns {Promise<DatabaseConnection>} 包含 MongoDB 客戶端和資料庫實例的物件
 * @throws {Error} 當連線失敗時拋出錯誤
 *
 * @example
 * ```typescript
 * const { db, client } = await connectToDatabase();
 * const collection = db.collection('your-collection');
 * ```
 */
export async function connectToDatabase(): Promise<DatabaseConnection> {
  // 如果已有快取的連線，直接返回
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // 運行時環境變數驗證
  if (!MONGODB_URI) {
    throw new Error(
      "請在 .env 檔案中定義 DB_LOCAL_URL 或 DB_SERVER_URL 環境變數"
    );
  }

  if (!MONGODB_DB_NAME) {
    throw new Error("請在 .env 檔案中定義 DB_NAME 環境變數");
  }

  try {
    // 建立新的 MongoDB 客戶端連線
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(MONGODB_DB_NAME);

    // 快取連線實例
    cachedClient = client;
    cachedDb = db;

    console.log(`✅ MongoDB 連線成功: ${MONGODB_DB_NAME}`);
    return { client, db };
  } catch (error) {
    console.error("❌ MongoDB 連線失敗:", error);
    throw new Error(
      `無法連線至 MongoDB: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
