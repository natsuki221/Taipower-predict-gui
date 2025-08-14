import { ReserveType } from "@/lib/reserve-type";

/**
 * 將原始 CSV 字串數據轉換為結構化的 ReserveType 陣列。
 * 此版本增加了對無效或空行的防錯處理，並將日期轉換為 Date 物件。
 *
 * @param csvData - 包含電力預備數據的 CSV 格式字串。
 * @returns - 轉換後的 ReserveType 物件陣列。
 */
export const reserveAdapter = (csvData: string): ReserveType[] => {
  // 1. 將 CSV 字串按行分割。
  const rows = csvData.trim().split('\n');

  // 2. 獲取當前年份，用於將 MM/DD 格式的日期補完。
  const currentYear = new Date().getFullYear();

  /**
   * 一個內部輔助函式，用於將字串轉換為數字或 null。
   * @param value - 要轉換的字串。
   * @returns - 轉換後的數字或 null。
   */
  const parseNumberOrNull = (value: string): number | null => {
    if (!value || value.trim() === '') {
      return null;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  };

  // 3. 遍歷每一行數據進行處理與轉換。
  const results = rows.map(row => {
    // 【防錯處理 1】如果行是空的或不包含逗號，直接跳過。
    if (!row || !row.includes(',')) {
      return null;
    }

    const [dateStr, peakLoad, reserveCapacity, reservePercentage] = row.split(',');

    // 【防錯處理 2】確保 dateStr 是有效字串且包含斜線。
    if (!dateStr || !dateStr.includes('/')) {
        return null;
    }

    const [month, day] = dateStr.split('/');

    // 【防錯處理 3】確保 month 和 day 都存在，才進行下一步。
    if (!month || !day) {
        return null;
    }

    // 5. 【核心修正】將日期字串轉換為 JavaScript Date 物件。
    //    我們先組合一個包含台灣時區的完整 ISO 字串，然後用它來建立 Date 物件。
    //    這樣可以確保 Date 物件代表的是台灣時間的午夜零時，MongoDB 會自動將其轉為 UTC 儲存。
    const datePart = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const timePart = 'T00:00:00.000+08:00';
    const isoDateTimeStringInTaiwan = datePart + timePart;
    const dateObject = new Date(isoDateTimeStringInTaiwan);

    // 6. 建立並返回符合 ReserveType 介面的物件。
    const reserveObject: ReserveType = {
      DateTime: dateObject, // 直接傳遞 Date 物件
      "瞬時尖峰負載(萬瓩)": parseNumberOrNull(peakLoad),
      "備轉容量(萬瓩)": parseNumberOrNull(reserveCapacity),
      "備轉容量率(%)": parseNumberOrNull(reservePercentage),
    };

    return reserveObject;
  });

  // 7. 過濾掉所有因無效行而產生的 null 值，確保回傳的陣列是乾淨的。
  return results.filter((item): item is ReserveType => item !== null);
};
