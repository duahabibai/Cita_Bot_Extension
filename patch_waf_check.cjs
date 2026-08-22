const fs = require('fs');
let code = fs.readFileSync('src/automation/handleProvinceSelection.ts', 'utf8');

const targetWait = `await page.waitForTimeout(10000); // Hard wait to ensure the proxy has loaded the next page`;

const newWait = `await page.waitForTimeout(10000); // Hard wait to ensure the proxy has loaded the next page

      // Check for WAF block (The requested URL was rejected)
      const pageText = await page.evaluate(() => document.body.innerText || '');
      if (pageText.includes('The requested URL was rejected') || pageText.includes('Please consult with your administrator')) {
          await bot.sendMessage(chatId, "🚨 WAF Block Detected! Extranjería's firewall (F5/Cloudflare) blocked the request. This usually happens if clicks are too robotic or the proxy IP is flagged.\\n\\nClosing browser to prevent permanent IP ban.");
          cleanupSession(chatId);
          return;
      }`;

code = code.replace(targetWait, newWait);
fs.writeFileSync('src/automation/handleProvinceSelection.ts', code);
console.log("Patched WAF checker");
