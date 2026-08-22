const fs = require('fs');
let code = fs.readFileSync('src/automation/handleProvinceSelection.ts', 'utf8');

const target = `      await bot.sendMessage(chatId, "⏳ Waiting for new page to load...");
      
      // Smart wait: wait for either offices dropdown, tramites dropdown, info button, or reject message
      try {
          await page.waitForFunction(() => {
              if (document.body && document.body.innerText.includes('The requested URL was rejected')) return true;
              const selects = Array.from(document.querySelectorAll('select'));
              if (selects.some(s => s.id.toLowerCase().includes('sede') || s.name.toLowerCase().includes('sede'))) return true;
              if (selects.some(s => s.id.toLowerCase().includes('tramite') || s.name.toLowerCase().includes('tramite'))) return true;
              const infoBtn = document.querySelector('#btnAceptar, input[value="Aceptar"], #btnEntrar, input[value="Entrar"]');
              if (infoBtn) return true;
              return false;
          }, { timeout: 30000 });
      } catch(e) {
          await bot.sendMessage(chatId, "⚠️ Timeout waiting for elements. The proxy might be very slow.");
      }`;

const replacement = `      await bot.sendMessage(chatId, "⏳ Waiting 10 seconds for the next page to fully render via proxy...");
      await page.waitForTimeout(10000); // Hard wait to ensure the proxy has loaded the next page`;

code = code.replace(target, replacement);

const target2 = `page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {}),`;
const replacement2 = `page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),`;
code = code.replace(target2, replacement2);

const target3 = `page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),`;
const replacement3 = `page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),`;
code = code.replace(target3, replacement3);

const target4 = `page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),`;
const replacement4 = `page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => {}),`;
code = code.replace(target4, replacement4);

fs.writeFileSync('src/automation/handleProvinceSelection.ts', code);
console.log("Reverted to 100% original wait logic");
