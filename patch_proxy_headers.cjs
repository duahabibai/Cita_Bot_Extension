const fs = require('fs');

let code = fs.readFileSync('src/handlers/launchBrowser.ts', 'utf8');

const oldLaunch = `    browser = await chromium.launch({
      headless: true,
      ignoreDefaultArgs: ["--enable-automation"],
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
      ],
      proxy: {
        server: PROXY_CONFIG.server,`;

const newLaunch = `    browser = await chromium.launch({
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
        server: PROXY_CONFIG.server,`;

code = code.replace(oldLaunch, newLaunch);
fs.writeFileSync('src/handlers/launchBrowser.ts', code);
console.log("Patched headers");
