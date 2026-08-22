const fs = require('fs');
let code = fs.readFileSync('src/automation/handleProvinceSelection.ts', 'utf8');

const target = `    try {
      await page.selectOption('select#form', selectedProv.value);
      await bot.sendMessage(chatId, \`✅ Province selected. Clicking 'Aceptar'...\`);
      
      // Removed wait here to speed up, moving wait to after click
      
      
      try {
          const preUrl = page.url();
          const btnSelector = '#btnAceptar, input[value="Aceptar"]';
          
          await page.waitForTimeout(1000);
          await page.hover(btnSelector).catch(() => {});
          
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => {}),
            page.click(btnSelector, { delay: 100, timeout: 5000 }).catch(() => {})
          ]);`;

const replacement = `    try {
      try {
          await page.selectOption('select#form', selectedProv.value);
      } catch (e) {}
      
      // Ensure the site registers the selection via JS events
      try {
          await page.evaluate(() => {
              const selectElement = document.querySelector('select#form');
              if (selectElement) {
                  selectElement.dispatchEvent(new Event('change', { bubbles: true }));
              }
          });
      } catch (e) {}
      await page.waitForTimeout(2000); // Give JS time to process

      await bot.sendMessage(chatId, \`✅ Province selected in dropdown. Clicking 'Aceptar'...\`);
      
      try {
          const preUrl = page.url();
          const btnSelector = '#btnAceptar, input[value="Aceptar"]';
          
          // Hide potential overlays before click
          await page.evaluate(() => {
              const overlays = document.querySelectorAll('[id*="cookie"], [class*="cookie"], [id*="aviso"], [class*="aviso"]');
              overlays.forEach(o => { o.style.display = 'none'; });
          }).catch(() => {});

          await page.waitForTimeout(Math.floor(Math.random() * 2000) + 1500);
          await page.hover(btnSelector).catch(() => {});
          await page.waitForTimeout(Math.floor(Math.random() * 400) + 200);
          
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),
            page.click(btnSelector, { delay: Math.floor(Math.random() * 150) + 50 }).catch(() => {})
          ]);`;

code = code.replace(target, replacement);

fs.writeFileSync('src/automation/handleProvinceSelection.ts', code);
console.log("Patched province selection click logic.");
