import { connectToDatabase } from "./mongodb"; // 修正：匯入連線函式
import { Collection } from "mongodb";

/**
 * 檢查指定的 collection 中是否已存在相同 DateTime 的文件。
 * 此服務旨在防止重複寫入資料。
 *
 * @param collectionName - 要檢查的 collection 名稱 (例如 'generators', 'weather')。
 * @param dateTime - 要檢查的 ISO 8601 日期時間字串。
 * @returns 如果文件已存在，則解析為 true，否則為 false。
 */
export const documentExists = async (
  collectionName: string,
  dateTime: string
): Promise<boolean> => {
  try {
    // 修正：呼叫連線函式以取得 client
    const { client } = await connectToDatabase();
    const db = client.db(process.env.MONGODB_DB_NAME);
    const collection: Collection<Document> = db.collection(collectionName);

    // 查詢具有相符 DateTime 的文件數量
    const count = await collection.countDocuments({ DateTime: dateTime });

    // 如果數量大於 0，表示文件已存在
    return count > 0;
  } catch (error) {
    console.error(`在 ${collectionName} 中檢查文件時發生錯誤:`, error);
    // 在發生錯誤的情況下，為求安全返回 true，以防止在資料庫連線不穩定時產生潛在的重複資料。
    return true;
  }
};
