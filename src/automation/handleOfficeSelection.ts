import { bot, activeSessions, userStates, cleanupSession, persistSessionState } from "../botContext.js";

export async function handleOfficeSelection(chatId: number, queryId: string, index: number) {
    const session = activeSessions.get(chatId);
    if (!session) {
      await bot.sendMessage(chatId, "⚠️ Session expired. Please click 'Launch Cloud Browser' again.");
      await bot.answerCallbackQuery(queryId);
      return;
    }
    const { page, offices } = session;
    const selectedOffice = offices?.[index];

    if (!selectedOffice) {
       await bot.sendMessage(chatId, "⚠️ Invalid office selection.");
       await bot.answerCallbackQuery(queryId);
       return;
    }

    if (!userStates.has(chatId)) userStates.set(chatId, {});
    userStates.get(chatId)!.office = selectedOffice;

    await bot.sendMessage(chatId, `🔄 Selecting office: ${selectedOffice.text}...`);
    await bot.answerCallbackQuery(queryId);

    try {
      // Select the office
      try {
          if (selectedOffice.selectId) {
              await page.selectOption(`select[id="${selectedOffice.selectId}"]`, selectedOffice.value).catch(() => {});
          } else if (selectedOffice.selectName) {
              await page.selectOption(`select[name="${selectedOffice.selectName}"]`, selectedOffice.value).catch(() => {});
          } else {
              await page.selectOption('select#sede', selectedOffice.value).catch(() => {});
          }
      } catch (e) {}
      
      // Ensure the site registers the selection via JS events (crucial for AJAX loading next dropdowns)
      try {
          await page.evaluate((val: string) => {
              const selects = Array.from(document.querySelectorAll('select'));
              let targetSelect = selects.find(s => s.id.toLowerCase().includes('sede') || s.name.toLowerCase().includes('sede'));
              if (!targetSelect) {
                 targetSelect = selects.find(s => Array.from(s.options).some(o => o.text.toLowerCase().includes('oficina')));
              }
              if (targetSelect) {
                  targetSelect.value = val;
                  targetSelect.dispatchEvent(new Event('change', { bubbles: true }));
              }
          }, selectedOffice.value);
      } catch (e: any) {
          // Ignore execution context destroyed errors, which happen if the page navigates
      }

      await bot.sendMessage(chatId, `✅ Office selected.`);
      
      // Small delay to allow the next dropdowns (Tramites) to possibly populate via Ajax
      await page.waitForTimeout(2000); 
      await bot.sendMessage(chatId, "🔍 Extracting available 'Trámites'...");
      
      let tramites: { text: string; value: string; selectId?: string }[] = [];
      try {
        // Wait for tramites dropdown generically using JS
        await page.waitForFunction(() => {
            const selects = Array.from(document.querySelectorAll('select'));
            return selects.some(s => s.id.toLowerCase().includes('tramite') || s.name.toLowerCase().includes('tramite'));
        }, { timeout: 15000 }).catch(() => {});
        
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
      } catch (e: any) {
        await bot.sendMessage(chatId, `⚠️ Could not locate the Trámites dropdown. The site might require a different step.\nError: ${e.message}`);
      }

      await bot.sendMessage(chatId, "📸 Taking screenshot of the updated form...");
      
      const screenshotBuffer = await page.screenshot({
        timeout: 30000,
        animations: 'disabled',
        type: 'jpeg',
        quality: 40
      });

      if (tramites.length > 0) {
          session.tramites = tramites;
          
          // --- DB SAVE INJECTION ---
          try {
              const provVal = userStates.get(chatId)?.province?.value;
              if (provVal) {
                  const dbPath = path.resolve('./fastmode_db.json');
                  let db = { provinces: [], offices: {}, tramites: {} };
                  if (fs.existsSync(dbPath)) {
                      try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch(e){}
                  }
                  db.tramites[provVal] = tramites;
                  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
              }
          } catch (e: any) {
              console.error("Failed to save tramites to fast DB", e);
          }
          // -------------------------

          await bot.sendMessage(chatId, `✅ Found ${tramites.length} Trámites.`);
          
          const inlineKeyboard = [];
          for (let i = 0; i < tramites.length; i++) {
            let buttonText = tramites[i].text;
            if (buttonText.length > 60) buttonText = buttonText.substring(0, 57) + "...";
            inlineKeyboard.push([{ text: buttonText, callback_data: `tramite_${i}` }]);
          }
          await bot.sendMessage(chatId, `✅ Selected Office: ${selectedOffice.text}\n\n📄 Please select a Trámite:`, { reply_markup: { inline_keyboard: inlineKeyboard } });
      } else {
          await bot.sendMessage(chatId, `✅ Selected Office: ${selectedOffice.text}\n⚠️ No Trámites found in the dropdown. Please let me know the next step.`);
      }
      
      await persistSessionState(chatId);
      // Reset timeout
      clearTimeout(session.timeoutId);
      session.timeoutId = setTimeout(async () => {
        await bot.sendMessage(chatId, "⏳ Session expired due to 10 minutes of inactivity.");
        cleanupSession(chatId);
      }, 10 * 60 * 1000);

    } catch (error: any) {
       await bot.sendMessage(chatId, `❌ Error selecting office:\n${error.message}\n\n📸 Taking debug screenshot...`);
       try {
           const errImg = await page.screenshot({ timeout: 15000, type: 'jpeg', quality: 40 });
           await bot.sendPhoto(chatId, errImg, { caption: "Debug screenshot of the error state." });
       } catch (e) {}
    }
}
