/**
 * @file /src/lib/weather-adapter.ts
 * @description 提供將 CWA API 原始天氣資料轉換為統一的 WeatherSnapshot 格式的適配器。
 * @author natsuki221
 * @version 3.0.0
 * @date 2025-08-11
 */

import {
  CwaApiResponse,
  CwaApiStation,
  WeatherSnapshot,
  StationData,
} from "./weather-types";

// =================================================================
// 1. 常數與輔助函式 (Constants & Helper Functions)
// =================================================================

const CWA_INVALID_VALUE = "-99";

/**
 * 安全地將 CWA API 回傳的字串值轉換為浮點數。
 * 如果值為無效標記 '-99' 或無法轉換，則回傳 null。
 * @param value - 來自 CWA API 的字串值。
 * @returns 轉換後的數字或 null。
 */
const safeParseFloat = (value: string | undefined): number | null => {
  if (value === undefined || value === CWA_INVALID_VALUE) {
    return null;
  }
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
};

/**
 * 安全地處理 CWA API 回傳的字串值。
 * 如果值為無效標記 '-99'，則回傳 null。
 * @param value - 來自 CWA API 的字串值。
 * @returns 原始字串或 null。
 */
const safeParseString = (value: string | undefined): string | null => {
  return value === undefined || value === CWA_INVALID_VALUE ? null : value;
};

// =================================================================
// 2. 主要適配器 (Main Adapter)
// =================================================================

/**
 * 將從 CWA API (O-A0001 & O-A0003) 取得的原始測站資料陣列，
 * 轉換為統一的、包含所有測站資料的單一 WeatherSnapshot 物件。
 *
 * @param apiResponses - 一個包含 CwaApiResponse 物件的陣列。
 * @returns 一個 WeatherSnapshot 物件，如果沒有有效資料則回傳 null。
 */
export const adaptCwaDataToSnapshot = (
  apiResponses: CwaApiResponse<CwaApiStation>[]
): WeatherSnapshot | null => {
  const allStations: CwaApiStation[] = apiResponses.flatMap(
    (response) => response.records?.Station || []
  );

  if (allStations.length === 0) {
    console.warn("[Adapter] No station data found in API responses.");
    return null;
  }

  // 以第一筆有效資料的時間戳記作為整個快照的統一時間
  const firstValidRecord = allStations.find(
    (s) => s.ObsTime && s.ObsTime.DateTime
  );
  if (!firstValidRecord) {
    console.warn("[Adapter] No valid observation time found in any record.");
    return null;
  }
  const snapshotTimestamp = new Date(firstValidRecord.ObsTime.DateTime);

  // 使用 Map 來處理來自不同 API 的重複測站資料，確保每個測站 ID 只出現一次
  const stationDataMap = new Map<string, StationData>();

  for (const record of allStations) {
    // 忽略沒有測站 ID 的無效資料
    if (!record.StationId) {
      continue;
    }

    const existingData: StationData =
      (stationDataMap.get(record.StationId) as StationData) ||
      ({} as StationData);

    const station: StationData = {
      stationId: record.StationId,
      stationName: record.StationName,
      countyName: record.GeoInfo.CountyName,
      townName: record.GeoInfo.TownName,
      weather:
        safeParseString(record.WeatherElement.Weather) ??
        existingData.weather ??
        null,
      windDirection:
        safeParseFloat(record.WeatherElement.WindDirection) ??
        existingData.windDirection ??
        null,
      windSpeed:
        safeParseFloat(record.WeatherElement.WindSpeed) ??
        existingData.windSpeed ??
        null,
      airTemperature:
        safeParseFloat(record.WeatherElement.AirTemperature) ??
        existingData.airTemperature ??
        null,
      relativeHumidity:
        safeParseFloat(record.WeatherElement.RelativeHumidity) ??
        existingData.relativeHumidity ??
        null,
      airPressure:
        safeParseFloat(record.WeatherElement.AirPressure) ??
        existingData.airPressure ??
        null,
      gustSpeed:
        safeParseFloat(record.WeatherElement.GustInfo?.PeakGustSpeed) ??
        existingData.gustSpeed ??
        null,
      dailyHigh:
        safeParseFloat(
          record.WeatherElement.DailyExtreme?.DailyHigh?.TemperatureInfo
            .AirTemperature
        ) ??
        existingData.dailyHigh ??
        null,
      dailyLow:
        safeParseFloat(
          record.WeatherElement.DailyExtreme?.DailyLow?.TemperatureInfo
            .AirTemperature
        ) ??
        existingData.dailyLow ??
        null,
    };

    stationDataMap.set(record.StationId, station);
  }

  return {
    timestamp: snapshotTimestamp,
    stations: Array.from(stationDataMap.values()),
  };
};
