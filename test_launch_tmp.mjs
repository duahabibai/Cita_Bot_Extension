import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
chromium.use(StealthPlugin());

const PROXY_CONFIG = {
  server: "http://geo.iproyal.com:12321",
  username: "T4Rw8zEYwYOch8Jy",
  password: "Jd2uEOIopKmWukQE_country-es_city-madrid"
};

try {
  const browser = await chromium.launch({
    headless: true,
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      '--disable-features=IsolateOrigins,site-per-process'
    ],
    proxy: {
      server: PROXY_CONFIG.server,
      username: PROXY_CONFIG.username,
      password: PROXY_CONFIG.password
    }
  });
  console.log("BROWSER LAUNCH OK");
  const context = await browser.newContext({
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  console.log("CONTEXT OK, navigating...");
  const start = Date.now();
  await page.goto('https://sede.administracionespublicas.gob.es/pagina/index/directorio/icpplus', { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log("NAVIGATION OK in", Date.now() - start, "ms URL:", page.url());
  await browser.close();
} catch (e) {
  console.error("ERROR:", e.message);
  process.exit(1);
}