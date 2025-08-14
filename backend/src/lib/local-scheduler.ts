import fetch from "node-fetch";
import cron from 'node-cron';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// 將任務按不同的排程分組
const TEN_MINUTE_JOBS = ["/api/generator-ingest"];
const HOURLY_JOBS = ["/api/weather-ingest"];
const DAILY_RESERVE_JOB = "/api/reserve-ingest"; // reserve-ingest 有獨立的排程

// 使用一個全域變數來儲存排程器的狀態，以防止在熱更新 (HMR) 時重複初始化。
const globalForScheduler = globalThis as unknown as {
  schedulerStarted: boolean;
};

// =================================================================
// 增強的日誌記錄器，自動加入時間戳記
// =================================================================
const log = (message: string, ...args: unknown[]) => {
    const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    console.log(`[${timestamp}] [LocalScheduler] ${message}`, ...args);
};

const error = (message: string, ...args: unknown[]) => {
    const timestamp = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    console.error(`[${timestamp}] [LocalScheduler] ERROR: ${message}`, ...args);
};


async function triggerEndpoint(endpoint: string): Promise<void> {
  const url = `${BASE_URL}${endpoint}`;
  log(`觸發: ${url}`);
  try {
    const response = await fetch(url, { method: "POST" }); // 建議使用 POST 觸發操作
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`伺服器回應錯誤碼 ${response.status}: ${errorBody}`);
    }
    const result = await response.json();
    log(`成功: ${url}`, result);
  } catch (err) {
    error(`失敗: ${url}`, err);
  }
}

export function startLocalScheduler(): void {
  // 只在開發模式且排程器尚未啟動時執行
  if (process.env.NODE_ENV !== "development" || globalForScheduler.schedulerStarted) {
    return;
  }
  
  log("正在為開發環境啟動...");
  globalForScheduler.schedulerStarted = true;

  // 1. 系統啟動時立即執行所有任務
  log("系統啟動，立即執行所有任務...");
  [...TEN_MINUTE_JOBS, ...HOURLY_JOBS, DAILY_RESERVE_JOB].forEach(triggerEndpoint);

  // 2. 設定每 10 分鐘的排程 (generator-ingest)
  cron.schedule('*/10 * * * *', () => {
    log("每 10 分鐘排程：開始執行任務...");
    TEN_MINUTE_JOBS.forEach(triggerEndpoint);
  });

  // 3. 設定每小時的排程 (weather-ingest)
  cron.schedule('0 * * * *', () => {
    log("每小時排程：開始執行任務...");
    HOURLY_JOBS.forEach(triggerEndpoint);
  });

  // 4. 設定每日 19:30 的排程 (reserve-ingest)
  cron.schedule('30 19 * * *', () => {
    log("每日 19:30 排程：開始執行任務...");
    triggerEndpoint(DAILY_RESERVE_JOB);
  }, {
    timezone: "Asia/Taipei"
  });


  log(`已啟動。首次任務已執行，並已設定多個排程：`);
  console.log(`  - 每 10 分鐘: ${TEN_MINUTE_JOBS.join(', ')}`);
  console.log(`  - 每小時: ${HOURLY_JOBS.join(', ')}`);
  console.log(`  - 每日 19:30: ${DAILY_RESERVE_JOB}`);
}
