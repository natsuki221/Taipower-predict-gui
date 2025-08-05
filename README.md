# Taipower Predict GUI

台電電力預測系統 - 前後端分離架構

## 專案結構

```
├── frontend/          # Angular 前端應用
├── backend/           # Next.js 後端應用
├── .env.example       # 環境變數範本
└── README.md          # 專案說明文件
```

## 開發環境設定

1. 複製環境變數檔案：
   ```bash
   cp .env.example .env
   ```

2. 編輯 `.env` 檔案，填入實際的設定值

3. 安裝前端依賴：
   ```bash
   cd frontend
   npm install
   ```

4. 安裝後端依賴：
   ```bash
   cd backend
   npm install
   ```

## 啟動開發服務器

### 前端 (Angular)
```bash
cd frontend
npm start
```

### 後端 (Next.js)
```bash
cd backend
npm run dev
```

## 注意事項

- 請勿將 `.env` 檔案提交到版本控制系統
- 資料庫密碼和 API 金鑰請妥善保管
- 開發時請遵循各自專案的程式碼規範

## 貢獻指南

1. Fork 此專案
2. 建立功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交變更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request
