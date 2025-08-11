import asyncio
import json
import xml.etree.ElementTree as ET
from typing import List, Dict, Any

import aiohttp
import pandas as pd
from tqdm.asyncio import tqdm

# --- 配置 ---
SOURCE_JSON_FILE = 'response_1754903046461.json' # 包含 URL 列表的來源檔
OUTPUT_CSV_FILE = 'cwa_hourly_data_parsed.csv'    # 最終輸出的 CSV 檔名
MAX_CONCURRENT_REQUESTS = 10                      # 最大並發請求數

# --- 函式定義 ---

def find_value(element: ET.Element, path: str, ns: Dict[str, str]) -> Any:
    """
    安全地從 XML 元素中查找指定路徑的值。
    如果找不到元素，則返回 None。
    """
    found = element.find(path, ns)
    return found.text if found is not None else None

async def fetch_and_parse_xml(session: aiohttp.ClientSession, url: str) -> List[Dict[str, Any]]:
    """
    非同步地從 URL 獲取並解析 XML 資料。

    Args:
        session: aiohttp 客戶端會話。
        url: 要獲取的資料 URL。

    Returns:
        從 XML 中解析出的觀測站資料字典列表。
    """
    stations_data = []
    # 定義 XML 命名空間
    ns = {'cwa': 'urn:cwa:gov:tw:cwacommon:0.1'}
    
    try:
        async with session.get(url) as response:
            response.raise_for_status()
            xml_text = await response.text()
            root = ET.fromstring(xml_text)
            
            # 遍歷所有 Station 節點
            for station in root.findall('.//cwa:Station', ns):
                # 優先選取 WGS84 座標
                wgs84_coords = station.find(".//cwa:Coordinates[cwa:CoordinateName='WGS84']", ns)
                lat = lon = None
                if wgs84_coords is not None:
                    lat = find_value(wgs84_coords, 'cwa:StationLatitude', ns)
                    lon = find_value(wgs84_coords, 'cwa:StationLongitude', ns)

                # 提取所有需要的氣象元素
                weather_element = station.find('cwa:WeatherElement', ns)
                if weather_element is not None:
                    station_dict = {
                        'StationId': find_value(station, 'cwa:StationId', ns),
                        'StationName': find_value(station, 'cwa:StationName', ns),
                        'ObsTime': find_value(station, './/cwa:ObsTime/cwa:DateTime', ns),
                        'Latitude_WGS84': lat,
                        'Longitude_WGS84': lon,
                        'Altitude': find_value(station, './/cwa:StationAltitude', ns),
                        'CountyName': find_value(station, './/cwa:CountyName', ns),
                        'TownName': find_value(station, './/cwa:TownName', ns),
                        'Weather': find_value(weather_element, 'cwa:Weather', ns),
                        'Precipitation': find_value(weather_element, './/cwa:Now/cwa:Precipitation', ns),
                        'WindDirection': find_value(weather_element, 'cwa:WindDirection', ns),
                        'WindSpeed': find_value(weather_element, 'cwa:WindSpeed', ns),
                        'AirTemperature': find_value(weather_element, 'cwa:AirTemperature', ns),
                        'RelativeHumidity': find_value(weather_element, 'cwa:RelativeHumidity', ns),
                        'AirPressure': find_value(weather_element, 'cwa:AirPressure', ns),
                    }
                    stations_data.append(station_dict)
    except aiohttp.ClientError as e:
        print(f"錯誤：請求 URL 時發生錯誤 {url}: {e}")
    except ET.ParseError as e:
        print(f"錯誤：解析 XML 時失敗 {url}: {e}")
        
    return stations_data

async def process_data_download() -> pd.DataFrame:
    """
    主流程函式：讀取來源 JSON，並發下載並處理所有 XML 資料。
    """
    print(f"1. 正在從 '{SOURCE_JSON_FILE}' 讀取資料來源...")
    try:
        with open(SOURCE_JSON_FILE, 'r', encoding='utf-8') as f:
            index_data = json.load(f)
    except FileNotFoundError:
        print(f"錯誤：來源檔案 '{SOURCE_JSON_FILE}' 不存在。請確認檔案路徑。")
        return pd.DataFrame()

    urls = [item['ProductURL'] for item in index_data['dataset']['resources']['resource']['data']['time']]
    print(f"   提取到 {len(urls)} 個 XML 資料連結。")

    print("\n2. 開始非同步下載與解析 XML 資料...")
    all_stations_data = []
    
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_and_parse_xml(session, url) for url in urls]
        for f in tqdm.as_completed(tasks, total=len(tasks), desc="下載進度"):
            stations = await f
            if stations:
                all_stations_data.extend(stations)

    if not all_stations_data:
        print("警告：未成功下載或解析任何資料。")
        return pd.DataFrame()

    print(f"\n3. 資料合併完成，共處理了 {len(all_stations_data)} 筆觀測記錄。")
    return pd.DataFrame(all_stations_data)

# --- 主程式執行區 ---
if __name__ == "__main__":
    df = asyncio.run(process_data_download())

    if not df.empty:
        # 資料清理與轉換：將 -99 / -999 (無效值) 替換為空值
        df.replace(['-99', '-999', -99, -999], pd.NA, inplace=True)
        # 將應為數值的欄位轉換為數字型別，無法轉換的則忽略
        for col in df.columns:
            if col not in ['StationId', 'StationName', 'ObsTime', 'CountyName', 'TownName', 'Weather']:
                df[col] = pd.to_numeric(df[col], errors='coerce')
        
        # 儲存到 CSV
        df.to_csv(OUTPUT_CSV_FILE, index=False, encoding='utf-8-sig')
        print(f"\n✅ 資料已成功儲存至 '{OUTPUT_CSV_FILE}'")
        
        print("\n預覽前 5 筆資料：")
        print(df.head().to_markdown(index=False))