/**
 * @file logger.ts
 * @description 全域日誌記錄模組，提供統一的日誌輸出介面
 * @author natsuki221
 * @version 1.0.0
 */

import winston from "winston";

// 讓 logger 知道我們自訂的級別順序
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// 這是 development 環境下，我們希望日誌在 console 中顯示的樣子
const format = winston.format.combine(
  // 加上時間戳記
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  // 加上顏色
  winston.format.colorize({ all: true }),
  // 定義最終的輸出格式
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}`
  )
);

// Winston 的傳輸器，決定日誌要送到哪裡
const transports = [
  // 送到 console & logs
  new winston.transports.Console(),
  new winston.transports.File({
    filename: "logs/error.log",
    level: "error",
  }),
  new winston.transports.File({ filename: "logs/all.log" }),
];

// 建立 logger 實例
export const logger = winston.createLogger({
  level: "debug", // 只有級別等於或高於 'debug' 的日誌會被記錄
  levels,
  format,
  transports,
});
