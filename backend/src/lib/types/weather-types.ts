/**
 * @file /src/lib/weather-types.ts
 * @description 為 CWA O-A0001-001 和 O-A0003-001 API 回應以及資料庫儲存模型定義 TypeScript 型別。
 * @author natsuki221
 * @version 3.0.0
 * @date 2025-08-11
 */

// =================================================================
// 1. CWA API 原始回應型別 (Raw CWA API Response Types)
// =================================================================

/**
 * 代表 CWA API 回應中的單個天氣元素值。
 * 由於 API 回傳值均為字串，我們以此為基礎。
 */
type CwaElementValue = string;

/**
 * 代表 CWA API 回應中的地理空間資訊。
 */
interface CwaGeoInfo {
  CountyName: string;
  TownName: string;
}

/**
 * 代表 O-A0001-001 (自動氣象站) 和 O-A0003-001 (現在天氣觀測) 的通用測站紀錄結構。
 * 結合了兩種 API 可能出現的所有欄位。
 */
export interface CwaApiStation {
  StationId: string;
  StationName: string;
  ObsTime: {
    DateTime: string;
  };
  GeoInfo: CwaGeoInfo;
  WeatherElement: {
    Weather: CwaElementValue;
    WindDirection: CwaElementValue;
    WindSpeed: CwaElementValue;
    AirTemperature: CwaElementValue;
    RelativeHumidity: CwaElementValue;
    AirPressure: CwaElementValue;
    // O-A0001-001 特有欄位 (設為可選)
    GustInfo?: {
      PeakGustSpeed: CwaElementValue;
    };
    // O-A0003-001 特有欄位 (設為可選)
    DailyExtreme?: {
      DailyHigh?: {
        TemperatureInfo: {
          AirTemperature: CwaElementValue;
        };
      };
      DailyLow?: {
        TemperatureInfo: {
          AirTemperature: CwaElementValue;
        };
      };
    };
  };
}

/**
 * CWA API 的通用回應結構。
 * @template T - `records.Station` 陣列中元素的型別。
 */
export interface CwaApiResponse<T> {
  success: "true" | "false";
  records: {
    Station: T[];
  };
}

// =================================================================
// 2. 處理後的應用程式/資料庫型別 (Processed Application/Database Types)
// =================================================================

/**
 * 代表單一測站的已處理、標準化的天氣資料。
 * 這是組成快照的基礎單元。
 */
export interface StationData {
  stationId: string;
  stationName: string;
  countyName: string;
  townName: string;
  weather: string | null;
  windDirection: number | null;
  windSpeed: number | null;
  airTemperature: number | null;
  relativeHumidity: number | null;
  airPressure: number | null;
  gustSpeed: number | null;
  dailyHigh: number | null;
  dailyLow: number | null;
}

/**
 * 代表一個特定時間點的天氣資料快照，這是儲存於 MongoDB 的主要文件模型。
 * @property {Date} timestamp - 快照的時間戳記，作為文件的唯一時間索引。
 * @property {StationData[]} stations - 包含該時間點所有測站資料的陣列。
 */
export interface WeatherSnapshot {
  _id?: string; // MongoDB 自動產生的 ID
  timestamp: Date;
  stations: StationData[];
}
