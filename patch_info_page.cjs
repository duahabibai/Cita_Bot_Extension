const fs = require('fs');

let code = fs.readFileSync('src/automation/handleProvinceSelection.ts', 'utf8');

const target = "const screenshotBuffer = await page.screenshot({";
const replacement = `
      if (offices.length === 0 && tramites.length === 0) {
          const infoBtnSelector = '#btnAceptar, input[value="Aceptar"], #btnEntrar, input[value="Entrar"]';
          const infoBtn = await page.$(infoBtnSelector);
          if (infoBtn) {
              await bot.sendMessage(chatId, "⚠️ Info page detected. Auto-clicking 'Aceptar/Entrar' to proceed to the dropdowns...");
              await Promise.all([
                  page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => {}),
                  page.click(infoBtnSelector).catch(() => {})
              ]);
              
              await bot.sendMessage(chatId, "⏳ Re-extracting Offices and Trámites...");
              await page.waitForTimeout(1000);
              
              try {
                offices = await page.$$eval('select', (selects: HTMLSelectElement[]) => {
                  let targetSelect = selects.find(s => s.id.toLowerCase().includes('sede') || s.name.toLowerCase().includes('sede'));
                  if (!targetSelect) targetSelect = selects.find(s => Array.from(s.options).some(o => o.text.toLowerCase().includes('oficina')));
                  if (targetSelect) {
                     return Array.from(targetSelect.options)
                       .map(o => ({ text: o.textContent?.trim() || '', value: o.value, selectId: targetSelect!.id, selectName: targetSelect!.name }))
                       .filter(o => o.value !== '' && !o.text.includes('Seleccione'));
                  }
                  return [];
                });
              } catch(e) {}
              
              try {
                tramites = await page.$$eval('select', (selects: HTMLSelectElement[]) => {
                  let targetSelects = selects.filter(s => s.id.toLowerCase().includes('tramite') || s.name.toLowerCase().includes('tramite'));
                  let allOptions: { text: string; value: string; selectId: string; selectName: string }[] = [];
                  for (const select of targetSelects) {
                    for (const option of select.options) {
                      if (option.value !== '' && option.value !== '-1' && !option.text.toLowerCase().includes('despliega para ver')) {
                        allOptions.push({ text: option.textContent?.trim() || '', value: option.value, selectId: select.id, selectName: select.name });
                      }
                    }
                  }
                  return allOptions;
                });
              } catch(e) {}
          }
      }
      
      const screenshotBuffer = await page.screenshot({
`;

if (!code.includes('Info page detected')) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src/automation/handleProvinceSelection.ts', code);
    console.log("Patched handleProvinceSelection.ts with Info Page bypass");
} else {
    console.log("Already patched.");
}
