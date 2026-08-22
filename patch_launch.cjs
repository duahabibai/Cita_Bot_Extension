const fs = require('fs');
let code = fs.readFileSync('src/handlers/launchBrowser.ts', 'utf8');

const target = `      const buttonElement = await page.$('#submit');
      if (buttonElement) {
        await bot.sendMessage(chatId, "👉 Button found! Adding human delay before clicking...");
        await page.waitForTimeout(Math.floor(Math.random() * 1500) + 2000); // 2-3.5 seconds delay
        
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),
          page.click('#submit', { delay: Math.floor(Math.random() * 100) + 50 }).catch(() => {})
        ]);
        
        // Check for 403 Forbidden or 503 after submitting
        const postSubmitText = await page.evaluate(() => document.body.innerText || '');`;

const replacement = `      const buttonElement = await page.$('#submit');
      if (buttonElement) {
        await bot.sendMessage(chatId, "👉 Button found! Adding human delay before clicking...");
        await page.waitForTimeout(Math.floor(Math.random() * 1500) + 2000); // 2-3.5 seconds delay
        
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),
          page.click('#submit', { delay: Math.floor(Math.random() * 100) + 50 }).catch(() => {})
        ]);
        
        await page.waitForTimeout(3000);
        
        // Check for 403 Forbidden or 503 after submitting
        const postSubmitText = await page.evaluate(() => document.body ? document.body.innerText : '');`;

code = code.replace(target, replacement);

const target2 = `    try {
       await page.waitForSelector('select#form', { timeout: 30000 });
    } catch (e) {
       await bot.sendMessage(chatId, "⚠️ Could not find province dropdown. Taking debug screenshot...");
       try {`;

const replacement2 = `    try {
       await page.waitForSelector('select#form', { timeout: 30000 });
    } catch (e) {
       // Deep check for Forbidden before giving up
       const isForbidden = await page.evaluate(() => document.body && document.body.innerText.includes('Forbidden'));
       if (isForbidden) {
            if (usingOldSession) {
                if (fs.existsSync(sessionFilePath)) fs.unlinkSync(sessionFilePath);
                await browser.close().catch(() => {});
                return handleLaunchBrowser(chatId, true);
            } else {
                throw new Error("WAF 403 Forbidden Error Hit on a fresh IP. IP is blocked.");
            }
       }
       
       await bot.sendMessage(chatId, "⚠️ Could not find province dropdown. Taking debug screenshot...");
       try {`;

code = code.replace(target2, replacement2);

fs.writeFileSync('src/handlers/launchBrowser.ts', code);
console.log("Patched launchBrowser logic for better Forbidden detection");
