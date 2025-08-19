/**
 * @file instrumentation.ts
 * @description 註冊本地排程器，僅在開發環境下使用
 * @description 注意：此檔案僅在開發環境下使用，生產環境應使用 Vercel Cron Jobs 或其他外部排程服務
 * @author natsuki221
 * @version 1.0.0
 */

import { startLocalScheduler } from "@/lib/utils/local-scheduler";
import { logger } from "@/lib/utils/logger";

export function register() {
  startLocalScheduler();
  // console.log("Instrumentation registered");
  logger.info("[Instrumentation] Instrumentation registered");
}
