const fs = require('fs');

const code = `import { bot, activeSessions, userStates, cleanupSession, persistSessionState } from "../botContext.js";

export async function handleProvinceSelection(chatId: number, queryId: string, index: number) {
    const session = activeSessions.get(chatId);
    if (!session) {
      await bot.sendMessage(chatId, "⚠️ Session expired. Please click 'Launch Cloud Browser' again.");
      if (queryId) await bot.answerCallbackQuery(queryId).catch(() => {});
      return;
    }
    const { page, provinces } = session;
    const selectedProv = provinces?.[index];
    if (!selectedProv) {
       await bot.sendMessage(chatId, "⚠️ Invalid province selection.");
       if (queryId) await bot.answerCallbackQuery(queryId).catch(() => {});
       return;
    }
    if (!userStates.has(chatId)) userStates.set(chatId, {});
    userStates.get(chatId)!.province = selectedProv;
    await bot.sendMessage(chatId, \`🔄 Selecting province: \${selectedProv.text}...\`);
    if (queryId) await bot.answerCallbackQuery(queryId).catch(() => {});
    try {
      try {
          await page.selectOption('select#form', selectedProv.value);
      } catch (e) {}
      
      try {
          await page.evaluate(() => {
              const selectElement = document.querySelector('select#form');
              if (selectElement) {
                  selectElement.dispatchEvent(new Event('change', { bubbles: true }));
              }
          });
      } catch (e) {}
      await page.waitForTimeout(2000);

      await bot.sendMessage(chatId, \`✅ Province selected. Clicking 'Aceptar'...\`);
      
      let wasRejected = false;
      try {
          const preUrl = page.url();
          const btnSelector = '#btnAceptar, input[value="Aceptar"]';
          
          await page.evaluate(() => {
              const overlays = document.querySelectorAll('[id*="cookie"], [class*="cookie"], [id*="aviso"], [class*="aviso"]');
              overlays.forEach(o => { (o as HTMLElement).style.display = 'none'; });
          }).catch(() => {});

          await page.waitForTimeout(Math.floor(Math.random() * 2000) + 1500);
          await page.hover(btnSelector).catch(() => {});
          await page.waitForTimeout(Math.floor(Math.random() * 400) + 200);
          
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {}),
            page.click(btnSelector, { delay: Math.floor(Math.random() * 150) + 50 }).catch(() => {})
          ]);
          
          if (page.url() === preUrl) {
              await bot.sendMessage(chatId, "⚠️ Retrying via trusted event...");
              await Promise.all([
                 page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
                 page.evaluate((sel: string) => {
                     const el = document.querySelector(sel);
                     if (el) {
                         const evt = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
                         el.dispatchEvent(evt);
                     }
                 }, btnSelector).catch(() => {})
              ]);
          }
      } catch (clickErr: any) {
          await bot.sendMessage(chatId, \`⚠️ Navigation error: \${clickErr.message}\`);
      }
      
      await bot.sendMessage(chatId, "⏳ Waiting for new page to load...");
      
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
      }
      
      const isRejected = await page.evaluate(() => {
          return document.body && document.body.innerText.includes('The requested URL was rejected');
      });
      
      if (isRejected) {
          wasRejected = true;
          await bot.sendMessage(chatId, "🛑 SECURITY BLOCK (F5/Imperva): The requested URL was rejected. IP got blocked.");
          const errImg = await page.screenshot({ timeout: 15000, type: 'jpeg', quality: 50 });
          await bot.sendPhoto(chatId, errImg, { caption: "Blocked page screenshot." });
          return;
      }
      
      // Handle Info Page bypass
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
              page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
              page.click(infoBtnSelector, { delay: 100 }).catch(() => {})
          ]);
          
          await bot.sendMessage(chatId, "⏳ Waiting for dropdowns...");
          try {
              await page.waitForFunction(() => {
                  const selects = Array.from(document.querySelectorAll('select'));
                  return selects.some(s => s.id.toLowerCase().includes('sede') || s.name.toLowerCase().includes('sede') || s.id.toLowerCase().includes('tramite') || s.name.toLowerCase().includes('tramite'));
              }, { timeout: 25000 });
          } catch(e) {}
      }
      
      await bot.sendMessage(chatId, "⏳ Extracting Offices and Trámites...");
      
      let offices: { text: string; value: string; selectId?: string; selectName?: string }[] = [];
      try {
        offices = await page.$$eval('select', (selects: HTMLSelectElement[]) => {
          let targetSelect = selects.find(s => s.id.toLowerCase().includes('sede') || s.name.toLowerCase().includes('sede'));
          if (!targetSelect) {
             targetSelect = selects.find(s => Array.from(s.options).some(o => o.text.toLowerCase().includes('oficina')));
          }
          if (targetSelect) {
             return Array.from(targetSelect.options)
               .map(o => ({ text: o.textContent?.trim() || '', value: o.value, selectId: targetSelect!.id, selectName: targetSelect!.name }))
               .filter(o => o.value !== '' && !o.text.includes('Seleccione'));
          }
          return [];
        });
      } catch (e) {}
      
      let tramites: { text: string; value: string; selectId?: string; selectName?: string }[] = [];
      try {
        tramites = await page.$$eval('select', (selects: HTMLSelectElement[]) => {
          let targetSelects = selects.filter(s => s.id.toLowerCase().includes('tramite') || s.name.toLowerCase().includes('tramite'));
          let allOptions: { text: string; value: string; selectId: string; selectName: string }[] = [];
          
          for (const select of targetSelects) {
            for (const option of select.options) {
              if (option.value !== '' && option.value !== '-1' && !option.text.toLowerCase().includes('despliega para ver')) {
                allOptions.push({
                  text: option.textContent?.trim() || '',
                  value: option.value,
                  selectId: select.id,
                  selectName: select.name
                });
              }
            }
          }
          return allOptions;
        });
      } catch (e) {}
      
      const screenshotBuffer = await page.screenshot({ timeout: 30000, animations: 'disabled', type: 'jpeg', quality: 40 });
      
      if (offices.length > 0) {
          session.offices = offices;
          session.tramites = tramites;
          
          await bot.sendMessage(chatId, \`✅ Found \${offices.length} offices and \${tramites.length} trámites.\`);
          const inlineKeyboard = [];
          for (let i = 0; i < offices.length; i++) {
            let buttonText = offices[i].text;
            if (buttonText.length > 60) buttonText = buttonText.substring(0, 57) + "...";
            inlineKeyboard.push([{ text: buttonText, callback_data: \`office_\${i}\` }]);
          }
          await bot.sendMessage(chatId, \`✅ Selected Province: \${selectedProv.text}\\n\\n🏢 Please select an Office:\`, { reply_markup: { inline_keyboard: inlineKeyboard } });
      } else if (tramites.length > 0) {
          session.tramites = tramites;
          await bot.sendMessage(chatId, \`✅ Found 0 offices, but \${tramites.length} trámites.\`);
          
          const inlineKeyboard = [];
          for (let i = 0; i < tramites.length; i++) {
            let buttonText = tramites[i].text;
            if (buttonText.length > 60) buttonText = buttonText.substring(0, 57) + "...";
            inlineKeyboard.push([{ text: buttonText, callback_data: \`tramite_\${i}\` }]);
          }
          await bot.sendMessage(chatId, \`✅ Selected Province: \${selectedProv.text}\\n\\n📄 No specific office dropdown. Please select a Trámite:\`, { reply_markup: { inline_keyboard: inlineKeyboard } });
      } else {
          await bot.sendPhoto(chatId, screenshotBuffer, { caption: \`✅ Selected Province: \${selectedProv.text}\\n⚠️ No offices or trámites found on this page. The layout might be different.\` });
      }
      
      await persistSessionState(chatId);
      
      clearTimeout(session.timeoutId);
      session.timeoutId = setTimeout(async () => {
        await bot.sendMessage(chatId, "⏳ Session expired due to 10 minutes of inactivity.");
        cleanupSession(chatId);
      }, 10 * 60 * 1000);
    } catch (error: any) {
       await bot.sendMessage(chatId, \`❌ Error moving to next step:\\n\${error.message}\\n\\n📸 Taking debug screenshot...\`);
       try {
           const errImg = await page.screenshot({ timeout: 15000, type: 'jpeg', quality: 40 });
           await bot.sendPhoto(chatId, errImg, { caption: "Debug screenshot of the error state." });
       } catch (e) {}
    }
}
`;

fs.writeFileSync('src/automation/handleProvinceSelection.ts', code);
console.log("Rewrote handleProvinceSelection with smart waitForFunction logic.");
