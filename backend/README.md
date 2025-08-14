# Taipower Predict GUI - 後端服務

## 專案簡介

**Taipower Predict GUI 後端服務**是一個基於 Next.js 的自動化資料擷取與處理系統，專門用於定時從台灣電力公司（台電）和中央氣象署（CWA）擷取電力及氣象資料，經過標準化處理後儲存至 MongoDB 時間序列資料庫。本系統為電力預測分析提供可靠的資料基礎設施。

## ✨ 功能特色

### 🔄 自動化資料擷取
- **發電機組資料**：每 10 分鐘從台電開放資料平台擷取即時發電機組資訊
- **天氣資料**：每小時從中央氣象署 API 擷取全台重要測站氣象觀測資料  
- **備轉容量資料**：每日 19:30 擷取電力系統備轉容量歷史資料

### 🛡️ 資料完整性保障
- **重複資料檢查**：內建智慧型重複資料偵測，防止資料冗餘
- **錯誤恢復機制**：具備完善的錯誤處理和日誌記錄
- **資料驗證**：多層次的資料格式驗證確保資料品質

### 🎯 手動觸發支援
- **RESTful API**：提供手動觸發各項資料擷取任務的 API 端點
- **開發除錯**：支援開發環境的即時測試和驗證

### 📊 標準化資料格式
- **TypeScript 類型系統**：完整的型別定義確保資料結構一致性
- **MongoDB 時間序列**：最適化的時間序列資料儲存方案
- **模組化架構**：可擴展的適配器模式支援新資料源整合

## 🚀 技術堆疊

| 技術 | 版本 | 用途 |
|------|------|------|
| **Next.js** | 15.4.5 | Web 框架與 API 路由 |
| **TypeScript** | ^5 | 型別安全的開發體驗 |
| **MongoDB** | ^6.18.0 | 時間序列資料庫 |
| **Node-cron** | ^4.2.1 | 任務排程 |
| **Node-fetch** | ^3.3.2 | HTTP 客戶端 |

## 📋 系統需求

- **Node.js**: 18.0.0 或更高版本
- **MongoDB**: 5.0 或更高版本（建議使用 6.0+）
- **記憶體**: 建議 2GB 以上
- **存儲空間**: 根據資料保留期間調整（建議 10GB+）

## ⚙️ 環境變數設定

在專案根目錄建立 `.env` 檔案，參考以下範本設定：

```bash
# 資料庫連線設定
DB_LOCAL_URL="mongodb://localhost:27017/"
DB_SERVER_URL="mongodb+srv://username:password@cluster.mongodb.net/"
DB_NAME="Taipower-predict-db"

# API 金鑰設定
WEATHER_API_KEY="your_cwa_api_key_here"
INTERNAL_API_KEY="your_internal_secure_key" # 生產環境建議設定

# 資料源 URL（通常不需修改）
GENERATING_UNITS_DATA="https://service.taipower.com.tw/data/opendata/apply/file/d006001/001.json"
RESERVE_API_URL="https://www.taipower.com.tw/d006/loadGraph/loadGraph/data/reserve.csv"

# 應用程式設定
NEXT_PUBLIC_APP_URL="http://localhost:3000" # 生產環境需修改
```

### 環境變數說明

| 變數名稱 | 必要性 | 說明 |
|----------|--------|-----------|
| `DB_LOCAL_URL` | 擇一 | 本地 MongoDB 連線 URI |
| `DB_SERVER_URL` | 擇一 | 遠端 MongoDB 連線 URI（如 Atlas） |
| `DB_NAME` | 必要 | MongoDB 資料庫名稱 |
| `WEATHER_API_KEY` | 必要 | 中央氣象署開放資料 API 金鑰 |
| `INTERNAL_API_KEY` | 建議 | 內部 API 授權金鑰（生產環境安全性） |
| `GENERATING_UNITS_DATA` | 必要 | 台電發電機組資料 API URL |
| `RESERVE_API_URL` | 必要 | 台電備轉容量資料 CSV URL |

## 🛠️ 安裝與啟動

### 1. 安裝依賴項目
```bash
npm install
```

### 2. 設定環境變數
```bash
# 複製範例檔案
cp ../.env.example .env

# 編輯環境變數檔案
vim .env
```

### 3. 啟動開發伺服器
```bash
npm run dev
```

### 4. 驗證服務狀態
開啟瀏覽器訪問 `http://localhost:3000`，系統應會自動啟動排程器並開始資料擷取。

## 📡 API 端點說明

### 資料擷取端點

| 端點 | 方法 | 功能 | 排程頻率 |
|------|------|------|----------|
| `/api/generator-ingest` | POST/GET | 擷取台電發電機組即時資料 | 每 10 分鐘 |
| `/api/weather-ingest` | POST/GET | 擷取氣象署測站觀測資料 | 每小時 |
| `/api/reserve-ingest` | POST/GET | 擷取電力系統備轉容量資料 | 每日 19:30 |

### 使用範例

#### 手動觸發發電資料擷取
```bash
curl -X POST http://localhost:3000/api/generator-ingest \
  -H "Content-Type: application/json"
```

#### 手動觸發天氣資料擷取
```bash
curl -X POST http://localhost:3000/api/weather-ingest \
  -H "Content-Type: application/json"
```

#### API 回應格式
```json
{
  "success": true,
  "message": "資料快照成功寫入！",
  "insertedId": "507f1f77bcf86cd799439011",
  "insertedCount": 95
}
```

## ⏰ 排程任務設定

### 開發環境
本系統在開發環境中會自動啟動內建排程器，排程設定如下：

```javascript
// 每 10 分鐘：發電機組資料
'*/10 * * * *' → /api/generator-ingest

// 每小時整點：氣象資料  
'0 * * * *' → /api/weather-ingest

// 每日 19:30：備轉容量資料
'30 19 * * *' → /api/reserve-ingest
```

### 生產環境部署建議

⚠️ **重要**：內建排程器僅適用於開發環境，生產環境請使用以下外部解決方案：

#### 選項 1: Vercel Cron Jobs（推薦用於 Vercel 部署）
```javascript
// vercel.json
{
  "crons": [
    {
      "path": "/api/generator-ingest",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/weather-ingest", 
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/reserve-ingest",
      "schedule": "30 19 * * *"
    }
  ]
}
```

#### 選項 2: GitHub Actions
```yaml
# .github/workflows/data-ingestion.yml
name: Data Ingestion
on:
  schedule:
    - cron: '*/10 * * * *'  # 發電資料
    - cron: '0 * * * *'     # 氣象資料  
    - cron: '30 19 * * *'   # 備轉容量
```

#### 選項 3: 外部 Cron 服務
- [cron-job.org](https://cron-job.org)
- [EasyCron](https://www.easycron.com)
- [Cronhub](https://cronhub.io)

#### 選項 4: 雲端排程服務
- **AWS**: EventBridge Rules
- **Google Cloud**: Cloud Scheduler
- **Azure**: Logic Apps

## 📁 專案結構

```
backend/
├── src/
│   ├── app/
│   │   └── api/              # API 路由目錄
│   │       ├── generator-ingest/
│   │       ├── weather-ingest/
│   │       └── reserve-ingest/
│   ├── lib/                  # 核心業務邏輯
│   │   ├── mongodb.ts        # 資料庫連線管理
│   │   ├── data-checker.ts   # 重複資料檢查
│   │   ├── local-scheduler.ts # 本地排程器
│   │   ├── *-adapter.ts      # 資料轉換適配器
│   │   └── *-types.ts        # TypeScript 型別定義
│   └── instrumentation.ts    # Next.js 儀表化設定
├── package.json
├── tsconfig.json
└── README.md
```

## 📊 資料庫結構

### MongoDB 集合設計

#### 1. `generating-unit` (發電機組資料)
```javascript
{
  "_id": ObjectId,
  "DateTime": ISODate,
  "metadata": {
    "source": "taipower-opendata"
  },
  "units": [
    {
      "unitType": "燃煤",
      "unitName": "台中#1",
      "installedCapacityMW": 550,
      "netGenerationMW": 520.5,
      "note": ""
    }
  ]
}
```

#### 2. `weather-snapshots` (氣象資料)
```javascript
{
  "_id": ObjectId,
  "timestamp": ISODate,
  "stations": [
    {
      "stationId": "C0A860",
      "stationName": "臺北",
      "countyName": "臺北市", 
      "townName": "中正區",
      "airTemperature": 25.6,
      "relativeHumidity": 78,
      "windSpeed": 2.1
    }
  ]
}
```

#### 3. `reserve-doc` (備轉容量資料)
```javascript
{
  "_id": ObjectId,
  "DateTime": ISODate,
  "瞬時尖峰負載(萬瓩)": 3234.7,
  "備轉容量(萬瓩)": 385.2,
  "備轉容量率(%)": 11.91
}
```

### 建議索引
```javascript
// 提升查詢效能的建議索引
db.getCollection('generating-unit').createIndex({"DateTime": 1})
db.getCollection('weather-snapshots').createIndex({"timestamp": 1}) 
db.getCollection('reserve-doc').createIndex({"DateTime": 1})
```

## 🔧 開發指令

```bash
# 安裝依賴
npm install

# 開發模式（啟用排程器）
npm run dev

# 建構應用程式
npm run build

# 生產模式啟動
npm run start

# 語法檢查
npm run lint

# 執行本地排程器（獨立模式）
npm run dev:scheduler
```

## 🛡️ 安全性考量

### 1. API 安全
- 生產環境建議設定 `INTERNAL_API_KEY` 進行 API 授權
- 使用 HTTPS 連線確保資料傳輸安全
- 定期更新 API 金鑰

### 2. 資料庫安全  
- MongoDB 連線使用強密碼
- 啟用 MongoDB 驗證機制
- 設定適當的網路存取控制

### 3. 環境變數保護
- 絕不將 `.env` 檔案提交至版本控制
- 使用安全的環境變數管理服務
- 定期輪換敏感憑證

## 📈 監控與日誌

### 日誌格式
系統採用結構化日誌格式，包含時間戳記和來源識別：
```
[2024-08-14 15:30:00] [LocalScheduler] 觸發: http://localhost:3000/api/generator-ingest
[2024-08-14 15:30:01] [Weather Ingest] 成功轉換 95 筆測站資料
```

### 監控重點
- 資料擷取成功率
- API 回應時間
- 資料庫查詢效能
- 系統記憶體使用量

## 🚨 故障排除

### 常見問題

#### 1. MongoDB 連線失敗
```bash
# 檢查 MongoDB 服務狀態
sudo systemctl status mongod

# 檢查連線字串格式
echo $DB_LOCAL_URL
```

#### 2. API 金鑰無效
```bash  
# 驗證氣象署 API 金鑰
curl "https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0001-001?Authorization=YOUR_API_KEY&limit=1"
```

#### 3. 排程未執行
- 確認開發環境設定 `NODE_ENV=development`
- 檢查 `instrumentation.ts` 是否正確載入
- 查看控制台是否有排程器啟動日誌

#### 4. 重複資料問題
- 檢查 DateTime 欄位索引是否建立
- 驗證資料轉換邏輯的時區處理
- 查看 data-checker 的效能警告

## 📞 支援與貢獻

### 問題回報
如果您遇到問題或有改善建議，請透過以下方式聯繫：

1. **GitHub Issues**：建立詳細的問題回報
2. **開發文件**：查閱專案技術文件
3. **日誌分析**：提供相關的系統日誌

### 開發貢獻
歡迎提交 Pull Request，請確保：

- 遵循 TypeScript 和 Airbnb 風格指南  
- 添加適當的 JSDoc 註解
- 包含單元測試（如適用）
- 更新相關文件

## 📜 授權條款

本專案採用 MIT 授權條款，詳見 [LICENSE](../LICENSE) 檔案。

---

**版本資訊**: 2.0.0  
**最後更新**: 2024-08-14  
**維護者**: 資深軟體工程師

> 🔔 **提醒**：本系統處理的是即時電力與氣象資料，請確保在生產環境中具備適當的監控和備份機制。
