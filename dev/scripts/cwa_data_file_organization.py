import pandas as pd

# --- 配置 ---
# 來源檔案 (由腳本 1 生成)
INPUT_CSV_FILE = 'cwa_hourly_data_parsed.csv'
# 篩選後要儲存的目標檔案名稱 (不含副檔名)
OUTPUT_FILENAME_BASE = 'filtered_cwa_data'

# 您指定的測站 ID 列表
CWA_STATION_IDS_STRING = (
    "C0AH50,C0AK10,467490,C0R260,C0R250,C0R140,C0R150,C0I110,C0I120,C0F0C0,C0F0D0,"
    "C0F0E0,C0F0A0,C0K290,C0K280,C0C590,C0C740,C0C750,C0E590,C0E570,C0E920,C0R190,"
    "C0R180,C0C620,467050,C0C730,C0K410,467410,C0G650,C0G640,C0G660,C0G670,467480,"
    "C0M670,467420,C0M680,C0M690,C0W140,C0W150,C0A860,C0AJ20,467590,C0R690,C0R350,"
    "C0R620,C0R710,C0R730,C0R880,C0R890,C0W160,467110,C0W170,467990,C0E791,C0H950,"
    "C0H9A0,C0I130,C0I080,C0T9D0,C0T820,C0T9B0,C0TA20,C0TA40,C0TA50,C0TA80,C0A570,"
    "C0AH90,C0A530,C0U980,C0C670,C0M700,C0M710,C0M720,C0M730,C0M740,C0S700,C0SA10,"
    "C0S890,C0F9K0,C0F9L0,C0F9M0,C0G680,C0G690,C0G700,C0K300,C0K310,C0E420,C0E930,"
    "C0F9N0,C0F9O0,C0K320,C0K330,C0M750,C0M760,C0H970,467650"
)

# --- 輔助函式 ---

def safe_to_numeric(series: pd.Series) -> pd.Series:
    """將 Series 轉換為數值型別，並將無效值 (-99, -999) 轉為 pd.NA。"""
    series = series.replace(['-99', '-999'], pd.NA)
    return pd.to_numeric(series, errors='coerce')

def safe_to_datetime(series: pd.Series) -> pd.Series:
    """將 Series 轉換為日期時間型別，並將無效值轉為 pd.NaT。"""
    series = series.replace(['-99', '-999'], pd.NaT)
    return pd.to_datetime(series, errors='coerce')

# --- 核心功能 ---

def filter_and_format_data():
    """
    讀取原始天氣資料CSV，篩選、清理、格式化，並儲存為最終的 CSV 和 JSON 檔案。
    """
    # 1. 讀取來源 CSV 檔案
    try:
        print(f"1. 正在讀取來源檔案: '{INPUT_CSV_FILE}'...")
        df = pd.read_csv(INPUT_CSV_FILE, dtype={'StationId': str})
        print(f"   讀取完成，共 {len(df)} 筆資料。")
    except FileNotFoundError:
        print(f"錯誤：找不到來源檔案 '{INPUT_CSV_FILE}'。")
        print("請先執行第一個腳本來生成此檔案。")
        return

    # 2. 根據 StationId 篩選資料
    target_station_ids = set(CWA_STATION_IDS_STRING.split(','))
    print(f"\n2. 正在根據 {len(target_station_ids)} 個指定測站ID進行篩選...")
    df = df[df['StationId'].isin(target_station_ids)].copy()
    print(f"   篩選完成，剩下 {len(df)} 筆資料。")

    # 3. 資料清理與型別轉換
    print("\n3. 正在進行資料清理與型別轉換...")
    numeric_cols = [
        'AirTemperature', 'RelativeHumidity', 'AirPressure', 'WindSpeed', 
        'WindDirection', 'PeakGustSpeed', 'DailyHighTemp', 'DailyLowTemp'
    ]
    for col in numeric_cols:
        df[col] = safe_to_numeric(df[col])

    datetime_cols = ['ObsTime', 'PeakGustTime', 'DailyHighTempTime', 'DailyLowTempTime']
    for col in datetime_cols:
        df[col] = safe_to_datetime(df[col])
    
    df['Weather'] = df['Weather'].replace(['-99', '-999'], None)
    print("   清理完成。")

    # 4. 重新命名欄位以符合 TypeScript Data Model
    print("\n4. 正在重新命名欄位以符合您的 Data Model...")
    rename_map = {
        'StationId': 'stationId',
        'StationName': 'stationName',
        'CountyName': 'countyName',
        'TownName': 'townName',
        'ObsTime': 'dateTime',
        'Weather': 'weather',
        'AirTemperature': 'airTemperature',
        'RelativeHumidity': 'relativeHumidity',
        'AirPressure': 'airPressure',
        'WindSpeed': 'windSpeed',
        'WindDirection': 'windDirection',
        'PeakGustSpeed': 'peakGustSpeed',
        'PeakGustTime': 'peakGustTime',
        'DailyHighTemp': 'dailyHighTemp',
        'DailyHighTempTime': 'dailyHighTempTime',
        'DailyLowTemp': 'dailyLowTemp',
        'DailyLowTempTime': 'dailyLowTempTime'
    }
    df.rename(columns=rename_map, inplace=True)
    
    # 依照模型順序排列欄位
    ordered_columns = list(rename_map.values())
    df = df[ordered_columns]
    print("   欄位命名完成。")

    # 5. 匯出檔案
    if not df.empty:
        # --- 儲存為 CSV ---
        csv_filename = f"{OUTPUT_FILENAME_BASE}.csv"
        print(f"\n5a. 正在將結果儲存至 '{csv_filename}'...")
        df.to_csv(csv_filename, index=False, encoding='utf-8-sig')
        print(f"   ✅ CSV 檔案儲存成功。")

        # --- 儲存為 JSON ---
        json_filename = f"{OUTPUT_FILENAME_BASE}.json"
        print(f"\n5b. 正在將結果儲存至 '{json_filename}'...")
        df_for_json = df.astype(object).where(pd.notnull(df), None)
        df_for_json.to_json(
            json_filename, 
            orient='records', 
            force_ascii=False, 
            indent=2, 
            date_format='iso'
        )
        print(f"   ✅ JSON 檔案儲存成功。")
        print("\n🎉 所有檔案匯出完成！")
    else:
        print("\n警告：篩選後沒有任何資料，因此未產生新檔案。")

# --- 主程式執行區 ---
if __name__ == "__main__":
    filter_and_format_data()
