const fs = require('fs');

let code = fs.readFileSync('src/automation/handleProvinceSelection.ts', 'utf8');

const target = "await bot.sendMessage(chatId, `✅ Province selected. Clicking 'Aceptar'...`);";
const replacement = `await bot.sendMessage(chatId, \`✅ Province selected. Clicking 'Aceptar'...\`);
      
      // Removed wait here to speed up, moving wait to after click`;

code = code.replace(target, replacement);

const target2 = `await bot.sendMessage(chatId, "⏳ Extracting Offices and Trámites (Process)...");
      await page.waitForTimeout(1000);`;
const replacement2 = `await bot.sendMessage(chatId, "⏳ Waiting 8 seconds for the next page to fully load (Proxy delay)...");
      await page.waitForTimeout(8000);
      await bot.sendMessage(chatId, "⏳ Extracting Offices and Trámites...");`;
      
code = code.replace(target2, replacement2);

fs.writeFileSync('src/automation/handleProvinceSelection.ts', code);
console.log("Wait fix applied.");
