import { bot, activeSessions, userStates, cleanupSession, persistSessionState } from "../botContext.js";
import path from "path";
import fs from "fs";

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
    await bot.sendMessage(chatId, `🔄 Selecting province: ${selectedProv.text}...`);
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

      await bot.sendMessage(chatId, `✅ Province selected. Clicking 'Aceptar'...`);
      

      try {
          const preUrl = page.url();
          const btnSelector = '#btnAceptar, input[value="Aceptar"]';
          
          await page.evaluate(() => {
              const overlays = document.querySelectorAll('[id*="cookie"], [class*="cookie"], [id*="aviso"], [class*="aviso"]');
              overlays.forEach(o => { (o as HTMLElement).style.display = 'none'; });
          }).catch(() => {});

          // Stealth interactions to bypass WAF
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
          ]);
          
          if (page.url() === preUrl) {
              await bot.sendMessage(chatId, "⚠️ Retrying via trusted event...");
              await Promise.all([
                 page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),
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
          await bot.sendMessage(chatId, `⚠️ Navigation error: ${clickErr.message}`);
      }
      
      await bot.sendMessage(chatId, "⏳ Waiting 10 seconds for the next page to fully render via proxy...");
      await page.waitForTimeout(10000); // Hard wait to ensure the proxy has loaded the next page

      // Check for WAF block (The requested URL was rejected)
      const pageText = await page.evaluate(() => document.body.innerText || '');
      if (pageText.includes('The requested URL was rejected') || pageText.includes('Please consult with your administrator')) {
          await bot.sendMessage(chatId, "🚨 WAF Block Detected! Extranjería's firewall (F5/Cloudflare) blocked the request. This usually happens if clicks are too robotic or the proxy IP is flagged.\n\nClosing browser to prevent permanent IP ban.");
          cleanupSession(chatId);
          return;
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
      
      // --- DB SAVE INJECTION ---
      try {
          const dbPath = path.resolve('./fastmode_db.json');
          let db = { provinces: [], offices: {}, tramites: {} };
          if (fs.existsSync(dbPath)) {
              try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch(e){}
          }
          if (offices && offices.length > 0) db.offices[selectedProv.value] = offices;
          if (tramites && tramites.length > 0) db.tramites[selectedProv.value] = tramites;
          fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
      } catch (e: any) {
          console.error("Failed to save offices/tramites to fast DB", e);
      }
      // -------------------------

      if (offices.length > 0) {
          session.offices = offices;
          session.tramites = tramites;
          
          await bot.sendMessage(chatId, `✅ Found ${offices.length} offices and ${tramites.length} trámites. (Saved to Database for ${selectedProv.text})`);
          const inlineKeyboard = [];
          for (let i = 0; i < offices.length; i++) {
            let buttonText = offices[i].text;
            if (buttonText.length > 60) buttonText = buttonText.substring(0, 57) + "...";
            inlineKeyboard.push([{ text: buttonText, callback_data: `office_${i}` }]);
          }
          inlineKeyboard.push([{ text: "🛑 Close Browser (Save MBs)", callback_data: "close_browser" }]);
          await bot.sendMessage(chatId, `✅ Selected Province: ${selectedProv.text}\n\n🏢 Please select an Office:`, { reply_markup: { inline_keyboard: inlineKeyboard } });
      } else if (tramites.length > 0) {
          session.tramites = tramites;
          await bot.sendMessage(chatId, `✅ Found 0 offices, but ${tramites.length} trámites. (Saved to Database for ${selectedProv.text})`);
          
          const inlineKeyboard = [];
          for (let i = 0; i < tramites.length; i++) {
            let buttonText = tramites[i].text;
            if (buttonText.length > 60) buttonText = buttonText.substring(0, 57) + "...";
            inlineKeyboard.push([{ text: buttonText, callback_data: `tramite_${i}` }]);
          }
          inlineKeyboard.push([{ text: "🛑 Close Browser (Save MBs)", callback_data: "close_browser" }]);
          await bot.sendMessage(chatId, `✅ Selected Province: ${selectedProv.text}\n\n📄 No specific office dropdown. Please select a Trámite:`, { reply_markup: { inline_keyboard: inlineKeyboard } });
      } else {
          await bot.sendPhoto(chatId, screenshotBuffer, { caption: `✅ Selected Province: ${selectedProv.text}\n⚠️ No offices or trámites found on this page. The layout might be different.` });
      }
      
      await persistSessionState(chatId);
      
      clearTimeout(session.timeoutId);
      session.timeoutId = setTimeout(async () => {
        await bot.sendMessage(chatId, "⏳ Session expired due to 10 minutes of inactivity.");
        cleanupSession(chatId);
      }, 10 * 60 * 1000);
    } catch (error: any) {
       await bot.sendMessage(chatId, `❌ Error moving to next step:\n${error.message}\n\n📸 Taking debug screenshot...`);
       try {
           const errImg = await page.screenshot({ timeout: 15000, type: 'jpeg', quality: 40 });
           await bot.sendPhoto(chatId, errImg, { caption: "Debug screenshot of the error state." });
       } catch (e) {}
    }
}
