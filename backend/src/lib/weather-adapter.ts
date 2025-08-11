/**
 * @file weather-adapter.ts
 * @description 提供將 CWA API 原始天氣資料轉換為應用程式內部格式的適配器。
 * @author Aston Lin (linnatsuki221@gmail.com)
 * @version 2.3.1
 * @date 2025-08-11
 * @changes 修正 MongoDB 時序集合相容性：safeParseDate 現在回傳 Date 物件而非 ISO 字串
 */

import {
  CwaApiStationRecord,
  ProcessedWeatherData,
} from './weather-types';

// =================================================================
// 1. 常數定義 (Constants)
// =================================================================

const CWA_INVALID_VALUE = '-99';

// =================================================================
// 2. 輔助函式 (Helper Functions)
// =================================================================

const safeParseFloat = (value: string): number | null => {
  if (value === CWA_INVALID_VALUE) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
};

const safeParseString = (value: string): string | null => {
  return value === CWA_INVALID_VALUE ? null : value;
};

/**
 * 安全地解析日期字串並回傳 Date 物件（適用於 MongoDB 時序集合）
 * @param value - CWA API 提供的日期時間字串
 * @returns Date 物件或 null（如果日期無效）
 */
const safeParseDate = (value: string): Date | null => {
  if (value === CWA_INVALID_VALUE) return null;
  const date = new Date(value);
  // 驗證日期是否有效
  return isNaN(date.getTime()) ? null : date;
};

// =================================================================
// 3. 主要適配器 (Main Adapter)
// =================================================================

/**
 * 將從 CWA API 取得的一批原始觀測站資料，轉換為扁平化、適合應用程式使用的格式。
 * [v2.3.1] 修正：
 * 1. safeParseDate 現在回傳 Date 物件而非 ISO 字串，以符合 MongoDB 時序集合要求。
 * 2. 對所有日期欄位統一使用 safeParseDate。
 * 3. 過濾掉主要觀測時間 (ObsTime) 無效的紀錄，確保資料完整性。
 *
 * @param records - 從 CWA API `records.Station` 取得的觀測站資料陣列。
 * @returns 一個只包含有效觀測紀錄的 `ProcessedWeatherData` 陣列。
 */
export const adaptCwaRecordsToProcessedData = (
  records: CwaApiStationRecord[]
): ProcessedWeatherData[] => {
  if (!records || records.length === 0) {
    return [];
  }

  const mappedRecords = records.map((record): ProcessedWeatherData | null => {
    const { WeatherElement, GeoInfo, ObsTime, StationId, StationName } = record;

    // 步驟 1: 驗證最關鍵的觀測時間，若無效則整筆紀錄作廢。
    const validDateTime = safeParseDate(ObsTime.DateTime);
    if (!validDateTime) {
      console.warn(`[Adapter] Skipping record for station ${StationId} due to invalid ObsTime: ${ObsTime.DateTime}`);
      return null;
    }

    const dailyHighInfo = WeatherElement.DailyExtreme?.DailyHigh?.TemperatureInfo;
    const dailyLowInfo = WeatherElement.DailyExtreme?.DailyLow?.TemperatureInfo;
    const gustInfo = WeatherElement.GustInfo;

    // 步驟 2: 轉換為處理後的資料格式
    const processedData: ProcessedWeatherData = {
      stationId: StationId,
      stationName: StationName,
      countyName: GeoInfo.CountyName,
      townName: GeoInfo.TownName || null,
      dateTime: validDateTime, // 現在是 Date 物件而非字串
      weather: safeParseString(WeatherElement.Weather),
      airTemperature: safeParseFloat(WeatherElement.AirTemperature),
      relativeHumidity: safeParseFloat(WeatherElement.RelativeHumidity),
      airPressure: safeParseFloat(WeatherElement.AirPressure),
      windSpeed: safeParseFloat(WeatherElement.WindSpeed),
      windDirection: safeParseFloat(WeatherElement.WindDirection),
      peakGustSpeed: gustInfo ? safeParseFloat(gustInfo.PeakGustSpeed) : null,
      peakGustTime: gustInfo ? safeParseDate(gustInfo.Occurred_at.DateTime) : null,
      dailyHighTemp: dailyHighInfo ? safeParseFloat(dailyHighInfo.AirTemperature) : null,
      dailyHighTempTime: dailyHighInfo ? safeParseDate(dailyHighInfo.Occurred_at.DateTime) : null,
      dailyLowTemp: dailyLowInfo ? safeParseFloat(dailyLowInfo.AirTemperature) : null,
      dailyLowTempTime: dailyLowInfo ? safeParseDate(dailyLowInfo.Occurred_at.DateTime) : null,
    };

    return processedData;
  });

  // 步驟 3: 過濾掉在步驟 1 中被標記為 null 的無效紀錄
  return mappedRecords.filter((record): record is ProcessedWeatherData => record !== null);
};