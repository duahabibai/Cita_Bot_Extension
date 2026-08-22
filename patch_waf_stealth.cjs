const fs = require('fs');

function updateStealth(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');
    
    // Add realistic mouse movements, scroll, and random delays before clicking Aceptar
    const oldClickLogic = `          await page.waitForTimeout(Math.floor(Math.random() * 2000) + 1500);
          await page.hover(btnSelector).catch(() => {});
          await page.waitForTimeout(Math.floor(Math.random() * 400) + 200);
          
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),
            page.click(btnSelector, { delay: Math.floor(Math.random() * 150) + 50 }).catch(() => {})
          ]);`;

    const newClickLogic = `          // Stealth interactions to bypass WAF
          await page.waitForTimeout(Math.floor(Math.random() * 1500) + 1000);
          
          // Random mouse jitter
          await page.mouse.move(Math.floor(Math.random() * 800), Math.floor(Math.random() * 600), { steps: 5 }).catch(() => {});
          await page.waitForTimeout(Math.floor(Math.random() * 500) + 200);
          
          // Scroll a bit
          await page.mouse.wheel(0, Math.floor(Math.random() * 300) + 100).catch(() => {});
          await page.waitForTimeout(Math.floor(Math.random() * 800) + 500);

          await page.hover(btnSelector).catch(() => {});
          await page.waitForTimeout(Math.floor(Math.random() * 600) + 300);
          
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),
            page.click(btnSelector, { delay: Math.floor(Math.random() * 200) + 80 }).catch(() => {})
          ]);`;

    code = code.replace(oldClickLogic, newClickLogic);
    fs.writeFileSync(filePath, code);
}

updateStealth('src/automation/handleProvinceSelection.ts');
console.log("Patched WAF stealth bypass");
