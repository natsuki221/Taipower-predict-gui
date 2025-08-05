import { TaipowerRawData, PowerGenerationSnapshot, UnitData } from "./types";

const parseNumericValue = (value: string): number | null => {
  // ... (此輔助函式維持不變)
  if (
    typeof value !== "string" ||
    value.trim() === "-" ||
    value.trim() === "N/A"
  ) {
    return null;
  }
  const cleanedValue = value.replace(/\(.*?\)/g, "").trim();
  const number = parseFloat(cleanedValue);
  return isNaN(number) ? null : number;
};

/**
 * 將台電 API 原始資料轉換為單一的 PowerGenerationSnapshot 文件
 * @param rawData - 從 API 獲取的原始資料
 * @returns 符合 PowerGenerationSnapshot 格式的單一物件
 */
export function taipowerApiAdapter(
  rawData: TaipowerRawData
): PowerGenerationSnapshot {
  if (!rawData.DateTime || typeof rawData.DateTime !== "string") {
    throw new Error("Invalid or missing DateTime field in raw data.");
  }

  const DateTime = new Date(`${rawData.DateTime}Z`);

  if (isNaN(DateTime.getTime())) {
    throw new Error(
      `Failed to parse DateTime: "${rawData.DateTime}" into a valid Date object.`
    );
  }

  const units: UnitData[] = [];

  for (const item of rawData.aaData) {
    if (!item["機組名稱"] || item["機組名稱"].includes("小計")) {
      continue;
    }

    units.push({
      unitType: item["機組類型"],
      unitName: item["機組名稱"],
      installedCapacityMW: parseNumericValue(item["裝置容量(MW)"]),
      netGenerationMW: parseNumericValue(item["淨發電量(MW)"]),
      note: item["備註"].trim(),
    });
  }

  const snapshot: PowerGenerationSnapshot = {
    DateTime,
    metadata: {
      source: "taipower-opendata",
    },
    units: units,
  };

  return snapshot;
}
