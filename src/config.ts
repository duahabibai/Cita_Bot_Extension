export const PROXY_CONFIG = {
  server: "http://geo.iproyal.com:12321",
  username: "T4Rw8zEYwYOch8Jy",
  password: "Jd2uEOIopKmWukQE_country-es_city-madrid"
};

export const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8602774350:AAGhaSg22kz85pU8iCFVMkPybc1rhi1gMMw";
export const ADMIN_CHAT_IDS = process.env.TELEGRAM_ADMIN_CHAT_ID
  ? process.env.TELEGRAM_ADMIN_CHAT_ID.split(",").map((s) => s.trim())
  : ["7860277201"];

export const isAIStudio = process.env.APP_URL && (process.env.APP_URL.includes("ais-dev") || process.env.APP_URL.includes("ais-pre"));
