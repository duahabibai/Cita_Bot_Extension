const fs = require('fs');
let code = fs.readFileSync('src/handlers/launchBrowser.ts', 'utf8');

const targetStr = `await bot.sendMessage(chatId, "⚠️ Could not find province dropdown. Taking debug screenshot...");`;

const newCode = `const currentUrl = await page.url();
       const bodyHtml = await page.evaluate(() => document.body.outerHTML.substring(0, 500));
       await bot.sendMessage(chatId, "⚠️ Could not find province dropdown.\\nURL: " + currentUrl + "\\nBody: " + bodyHtml + "\\nTaking debug screenshot...");`;

code = code.replace(targetStr, newCode);
fs.writeFileSync('src/handlers/launchBrowser.ts', code);
console.log("Patched debug in launchBrowser.ts");
