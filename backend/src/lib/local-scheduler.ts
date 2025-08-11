import fetch from "node-fetch";

const BASE_URL = "http://localhost:3000"; // 您本地 Next.js 服務的 URL
const ENDPOINTS = ["/api/generator-ingest", "/api/weather-ingest"];
const INTERVAL_MS = 10 * 60 * 1000; // 10 分鐘

// 使用一個全域變數來儲存排程器的狀態，以防止在熱更新 (HMR) 時重複初始化。
const globalForScheduler = globalThis as unknown as {
  schedulerStarted: boolean;
};

async function triggerEndpoint(endpoint: string): Promise<void> {
  const url = `${BASE_URL}${endpoint}`;
  // const timestamp = new Date().toISOString();
  console.log(`[LocalScheduler] 觸發: ${url}`);
  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) throw new Error(`伺服器回應錯誤碼 ${response.status}`);
    console.log(`[LocalScheduler] 成功: ${url}`);
  } catch (error) {
    console.error(`[LocalScheduler] 失敗: ${url}`, error);
  }
}

function runAllJobs(): void {
  console.log("--- [LocalScheduler] 開始執行本輪任務 ---");
  ENDPOINTS.forEach(triggerEndpoint);
}

export function startLocalScheduler(): void {
  // 只在開發模式且排程器尚未啟動時執行
  if (
    process.env.NODE_ENV === "development" &&
    !globalForScheduler.schedulerStarted
  ) {
    console.log("--- [LocalScheduler] 正在為開發環境啟動... ---");
    globalForScheduler.schedulerStarted = true;

    runAllJobs(); // 立即執行第一次
    setInterval(runAllJobs, INTERVAL_MS); // 設定定時器

    console.log(
      `--- [LocalScheduler] 已啟動，將每 ${
        INTERVAL_MS / 1000 / 60
      } 分鐘執行一次。 ---`
    );
  }
}
