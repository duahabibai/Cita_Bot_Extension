const fs = require('fs');
let code = fs.readFileSync('src/automation/handleProvinceSelection.ts', 'utf8');

const target = `      const isRejected = await page.evaluate(() => {
          return document.body && document.body.innerText.includes('The requested URL was rejected');
      });
      
      if (isRejected) {
          wasRejected = true;
          await bot.sendMessage(chatId, "🛑 SECURITY BLOCK (F5/Imperva): The requested URL was rejected. IP got blocked.");
          const errImg = await page.screenshot({ timeout: 15000, type: 'jpeg', quality: 50 });
          await bot.sendPhoto(chatId, errImg, { caption: "Blocked page screenshot." });
          return;
      }`;
code = code.replace(target, "");

const target2 = `      // Handle Info Page bypass
      const infoBtnExists = await page.evaluate(() => {
          const selects = Array.from(document.querySelectorAll('select'));
          const hasDropdowns = selects.some(s => s.id.toLowerCase().includes('sede') || s.name.toLowerCase().includes('sede') || s.id.toLowerCase().includes('tramite') || s.name.toLowerCase().includes('tramite'));
          if (!hasDropdowns) {
              return !!document.querySelector('#btnAceptar, input[value="Aceptar"], #btnEntrar, input[value="Entrar"]');
          }
          return false;
      });
      
      if (infoBtnExists) {
          await bot.sendMessage(chatId, "⚠️ Info page detected. Bypassing...");
          const infoBtnSelector = '#btnAceptar, input[value="Aceptar"], #btnEntrar, input[value="Entrar"]';
          await page.hover(infoBtnSelector).catch(() => {});
          await page.waitForTimeout(500);
          await Promise.all([
              page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => {}),
              page.click(infoBtnSelector, { delay: 100 }).catch(() => {})
          ]);
          
          await bot.sendMessage(chatId, "⏳ Waiting for dropdowns...");
          try {
              await page.waitForFunction(() => {
                  const selects = Array.from(document.querySelectorAll('select'));
                  return selects.some(s => s.id.toLowerCase().includes('sede') || s.name.toLowerCase().includes('sede') || s.id.toLowerCase().includes('tramite') || s.name.toLowerCase().includes('tramite'));
              }, { timeout: 25000 });
          } catch(e) {}
      }`;
code = code.replace(target2, "");

const target3 = `      let wasRejected = false;`;
code = code.replace(target3, "");

fs.writeFileSync('src/automation/handleProvinceSelection.ts', code);
console.log("Removed custom info btn bypass that might be causing block");
