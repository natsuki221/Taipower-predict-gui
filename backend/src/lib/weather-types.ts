/**
 * @file weather-types.ts
 * @description 根據中央氣象署 (CWA) O-A0001-001 API 的回應重新設計的 TypeScript 型別定義。
 * @author Aston Lin (linnatsuki221@gmail.com)
 * @version 2.2.1
 * @date 2025-08-11
 * @changes 修正日期欄位型別：從字串改為 Date 物件以符合 MongoDB 時序集合要求
 */

// =================================================================
// 1. Raw API Response Types (原始 API 回應型別)
// =================================================================

/**
 * CWA API 的完整回應結構。
 */
export interface CwaApiResponse {
  success: 'true' | 'false';
  result: {
    resource_id: string;
    fields: { id: string; type: string }[];
  };
  records: {
    Station: CwaApiStationRecord[];
  };
}

/**
 * 代表單一氣象站的原始紀錄。
 * [v2.2.0] 修正：根據最新的 weather.json，將 DailyExtreme 物件結構還原。
 */
export interface CwaApiStationRecord {
  StationName: string;
  StationId: string;
  ObsTime: {
    DateTime: string;
  };
  GeoInfo: {
    CountyName: string;
    TownName?: string;
  };
  WeatherElement: {
    Weather: string;
    WindDirection: string;
    WindSpeed: string;
    AirTemperature: string;
    RelativeHumidity: string;
    AirPressure: string;
    GustInfo?: { // 設為可選以增加穩健性
      PeakGustSpeed: string;
      Occurred_at: {
        WindDirection: string;
        DateTime: string;
      };
    };
    // 修正：還原 DailyExtreme 結構，並設為可選
    DailyExtreme?: {
      DailyHigh?: {
        TemperatureInfo: {
          AirTemperature: string;
          Occurred_at: {
            DateTime: string;
          };
        };
      };
      DailyLow?: {
        TemperatureInfo: {
          AirTemperature: string;
          Occurred_at: {
            DateTime: string;
          };
        };
      };
    };
  };
}

// =================================================================
// 2. Processed Application/Database Types (應用程式/資料庫處理後型別)
// =================================================================

/**
 * 代表單筆已處理的、扁平化的氣象觀測資料。
 * 這是儲存於資料庫或在應用程式中使用的主要資料模型。
 * [v2.2.1] 修正：所有日期欄位現在使用 Date 物件而非字串，以符合 MongoDB 時序集合要求。
 */
export interface ProcessedWeatherData {
  _id?: string; // 資料庫 ID
  stationId: string;
  stationName: string;
  countyName: string;
  townName: string | null;
  
  // 觀測時間 - 現在是 Date 物件 (MongoDB 時序集合的 timeField)
  dateTime: Date;

  // 主要天氣元素
  weather: string | null;
  airTemperature: number | null; // 攝氏度 (°C)
  relativeHumidity: number | null; // 百分比 (%)
  airPressure: number | null; // 百帕 (hPa)
  windSpeed: number | null; // 公尺/秒 (m/s)
  windDirection: number | null; // 度 (°)

  // 陣風資訊 - 現在是 Date 物件
  peakGustSpeed: number | null; // 公尺/秒 (m/s)
  peakGustTime: Date | null;

  // 每日極值 - 現在是 Date 物件
  dailyHighTemp: number | null; // 攝氏度 (°C)
  dailyHighTempTime: Date | null;
  dailyLowTemp: number | null; // 攝氏度 (°C)
  dailyLowTempTime: Date | null;
}

/**
 * 代表在某個時間點，所有觀測站的氣象資料快照。
 * 主要用於一次性展示或匯總。
 */
export interface WeatherSnapshot {
  _id?: string; // 資料庫 ID
  snapshotTime: Date; // 現在使用 Date 物件，代表此快照的建立時間
  stations: StationSnapshotData[];
}

/**
 * 代表快照中單一測站的資料，是 ProcessedWeatherData 的子集。
 */
export interface StationSnapshotData {
  stationId: string;
  stationName: string;
  countyName: string;
  townName: string | null;
  airTemperature: number | null;
  weather: string | null;
}