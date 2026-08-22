const fs = require('fs');

let code = fs.readFileSync('src/automation/handleProvinceSelection.ts', 'utf8');

const target2 = `await bot.sendMessage(chatId, "⏳ Waiting 8 seconds for the next page to fully load (Proxy delay)...");
      await page.waitForTimeout(8000);`;
const replacement2 = `await bot.sendMessage(chatId, "⏳ Waiting 15 seconds for the next page to fully load (Proxy delay)...");
      await page.waitForTimeout(15000);`;
      
code = code.replace(target2, replacement2);

fs.writeFileSync('src/automation/handleProvinceSelection.ts', code);
console.log("Wait fix 2 applied.");
