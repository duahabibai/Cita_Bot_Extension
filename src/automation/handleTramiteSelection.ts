import { bot, activeSessions, userStates, cleanupSession, persistSessionState } from "../botContext.js";

export async function handleTramiteSelection(chatId: number, queryId: string, index: number) {
    const session = activeSessions.get(chatId);
    if (!session) {
      await bot.sendMessage(chatId, "⚠️ Session expired. Please click 'Launch Cloud Browser' again.");
      await bot.answerCallbackQuery(queryId);
      return;
    }
    const { page, tramites } = session;
    const selectedTramite = tramites?.[index];

    if (!selectedTramite) {
       await bot.sendMessage(chatId, "⚠️ Invalid Trámite selection.");
       await bot.answerCallbackQuery(queryId);
       return;
    }

    if (!userStates.has(chatId)) userStates.set(chatId, {});
    userStates.get(chatId)!.tramite = selectedTramite;

    await bot.sendMessage(chatId, `🔄 Selecting Trámite: ${selectedTramite.text}...`);
    await bot.answerCallbackQuery(queryId);

    try {
      try {
          if (selectedTramite.selectId) {
              await page.selectOption(`select[id="${selectedTramite.selectId}"]`, selectedTramite.value).catch(() => {});
          } else if (selectedTramite.selectName) {
              await page.selectOption(`select[name="${selectedTramite.selectName}"]`, selectedTramite.value).catch(() => {});
          }
      } catch (e) {}
      
      // Force selection via JS to guarantee it hits the right select element regardless of Playwright locator ambiguity
      try {
          await page.evaluate((val: string) => {
              const selects = Array.from(document.querySelectorAll('select')).filter(s => s.id.toLowerCase().includes('tramite') || s.name.toLowerCase().includes('tramite'));
              selects.forEach(s => {
                  const selectElem = s as HTMLSelectElement;
                  for (const opt of Array.from(selectElem.options)) {
                      if (opt.value === val) {
                          selectElem.value = val;
                          selectElem.dispatchEvent(new Event('change', { bubbles: true }));
                      }
                  }
              });
          }, selectedTramite.value);
      } catch (e: any) {
          // Ignore execution context destroyed errors
      }

      await page.waitForTimeout(2000);
      await bot.sendMessage(chatId, `✅ Trámite selected. Clicking 'Aceptar'...`);

      try {
        const preUrl = page.url();
        const btnSelector = '#btnAceptar, input[value="Aceptar"]';
        
        // Hide potential overlays before click
        await page.evaluate(() => {
            const overlays = document.querySelectorAll('[id*="cookie"], [class*="cookie"], [id*="aviso"], [class*="aviso"]');
            overlays.forEach(o => { (o as HTMLElement).style.display = 'none'; });
        }).catch(() => {});

        await page.waitForTimeout(Math.floor(Math.random() * 2000) + 1500);
        await page.hover(btnSelector).catch(() => {});
        await page.waitForTimeout(Math.floor(Math.random() * 400) + 200);

        await Promise.all([
          page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),
          page.click(btnSelector, { delay: Math.floor(Math.random() * 150) + 50 }).catch(() => {})
        ]);
        
        if (page.url() === preUrl) {
           await bot.sendMessage(chatId, "⚠️ URL didn't change native click. Retrying via trusted event...");
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

      await bot.sendMessage(chatId, "⏳ Waiting 8 seconds for the next page to fully render via proxy...");
      await page.waitForTimeout(8000);

      await bot.sendMessage(chatId, "🔍 Scraping available actions/buttons on this page (like Cl@ve, Entrar, etc.)...");
      
      
      // Scroll to bottom so screenshot shows the buttons
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      
      const dynamicButtons = await page.evaluate(() => {


          // Check standard buttons and also do a fallback search for images/links


          const foundBtns = [];
          // 1. Check known selectors first
          const buttonTargets = [
              { id: 'btnEntrar', label: 'Entrar (Sin Cl@ve)', selectors: ['#btnEntrar', 'input[value="Entrar"]', 'input[name="btnEntrar"]'] },
              { id: 'btnClave', label: 'Acceder con Cl@ve', selectors: ['#btnAccesoClave', '#btnEnviarClave', 'input[value*="Cl@ve"]', 'input[value*="Clave"]', 'input[name*="clave"]', 'img[alt*="Cl@ve"]', 'a[href*="clave"]', 'button[title*="Cl@ve"]', 'button[id*="clave"]', '.botonClave', '#clave'] },
              { id: 'btnAceptar', label: 'Aceptar', selectors: ['#btnAceptar', 'input[value="Aceptar"]'] },
              { id: 'btnSiguiente', label: 'Siguiente / Continuar', selectors: ['#btnSiguiente', 'input[value="Siguiente"]', 'input[value="Continuar"]'] }
          ];

          let idx = 0;
          for (const target of buttonTargets) {
              let foundForTarget = false;
              for (const sel of target.selectors) {
                  const elements = document.querySelectorAll(sel);
                  if (elements.length > 0) {
                      // Grab the first visible one
                      for (const el of Array.from(elements)) {
                          const rect = el.getBoundingClientRect();
                          if (rect.width > 0 && rect.height > 0) {
                              let finalSelector = sel;
                              if (el.id) {
                                  finalSelector = '#' + el.id;
                              } else if (el.name) {
                                  finalSelector = el.tagName.toLowerCase() + '[name="' + el.name + '"]';
                              } else {
                                  el.setAttribute('data-bot-id', 'fastbtn-' + idx);
                                  finalSelector = '[data-bot-id="fastbtn-' + idx + '"]';
                              }

                              foundBtns.push({
                                  text: target.label,
                                  selector: finalSelector,
                                  index: idx
                              });
                              idx++;
                              foundForTarget = true;
                              break;
                          }
                      }
                      if (foundForTarget) break;
                  }
              }
          }

          // 2. If Clave still wasn't found, look through ALL images and buttons for the word "cl@ve" or "clave"
          const claveAlreadyFound = foundBtns.some(b => b.text.includes('Cl@ve'));
          if (!claveAlreadyFound) {
              const allElements = document.querySelectorAll('img, button, input[type="image"], a');
              for (const el of Array.from(allElements)) {
                  const rect = el.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                      const text = (el.alt || el.title || el.src || el.href || el.innerText || el.value || '').toLowerCase();
                      if (text.includes('cl@ve') || text.includes('clave')) {
                          let finalSelector = '';
                          if (el.id) {
                              finalSelector = '#' + el.id;
                          } else {
                              el.setAttribute('data-bot-id', 'fastbtn-fallback-' + idx);
                              finalSelector = '[data-bot-id="fastbtn-fallback-' + idx + '"]';
                          }
                          foundBtns.push({
                              text: 'Acceder con Cl@ve (Found via Scan)',
                              selector: finalSelector,
                              index: idx
                          });
                          idx++;
                          break;
                      }
                  }
              }
          }

          return foundBtns;
      });

      // DEBUG: Log what buttons were actually found
      console.log('[TRAMITE] Buttons found on page:', dynamicButtons.length);
      if (dynamicButtons.length > 0) {
        console.log('[TRAMITE] Button details:', dynamicButtons.map(b => `${b.text} (selector: ${b.selector})`).join(', '));
      } else {
        console.log('[TRAMITE] NO BUTTONS FOUND! Page URL:', page.url());
        const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
        console.log('[TRAMITE] Page text preview:', pageText);
      }

      // CRITICAL CHECK: Warn if Cl@ve button is not found
      const claveButtonFound = dynamicButtons.some(b => b.text.includes('Cl@ve'));
      if (!claveButtonFound) {
        console.log('[TRAMITE] WARNING: Acceder con Cl@ve button NOT FOUND on this page!');
        console.log('[TRAMITE] This trámite may not support Cl@ve authentication.');
        console.log('[TRAMITE] Available buttons:', dynamicButtons.map(b => b.text).join(', '));

        await bot.sendMessage(
          chatId,
          "⚠️ Warning: 'Acceder con Cl@ve' button not found on this page.\n\n" +
          "This trámite may not support Cl@ve certificate authentication.\n\n" +
          "Available options: " + dynamicButtons.map(b => b.text).join(', ')
        );

        // Try to scan ALL page content for any Clave references
        const pageFullText = await page.evaluate(() => document.body.innerText);
        const hasClaveMention = pageFullText.toLowerCase().includes('clave') || pageFullText.toLowerCase().includes('cl@ve');
        console.log('[TRAMITE] Page mentions "clave":', hasClaveMention);
      }

      // Send button count to Telegram for visibility
      await bot.sendMessage(chatId, `🔍 Found ${dynamicButtons.length} button(s) on this page.`);
      
      session.dynamicButtons = dynamicButtons;
      
      await bot.sendMessage(chatId, "📸 Next page loaded. Taking screenshot...");
      const screenshotBuffer = await page.screenshot({
        timeout: 30000,
        animations: 'disabled',
        type: 'jpeg',
        quality: 40
      });
      
      const inline_keyboard = [];
      
      if (dynamicButtons && dynamicButtons.length > 0) {
          dynamicButtons.forEach(btn => {
              inline_keyboard.push([{ text: "🖱️ " + btn.text, callback_data: "dyn_" + btn.index }]);
          });
      }
      
      inline_keyboard.push([{ text: "📝 Autofill Form (NIE/Name) [Fallback]", callback_data: "autofill_form" }]);

      await bot.sendPhoto(chatId, screenshotBuffer, { 
          caption: `✅ Selected Trámite: ${selectedTramite.text}\nHere is the intermediate page. Please select the next action (e.g. Cl@ve, Entrar):`,
          reply_markup: { inline_keyboard }
      });
      
      await persistSessionState(chatId);
      
      // Reset timeout
      clearTimeout(session.timeoutId);
      session.timeoutId = setTimeout(async () => {
        await bot.sendMessage(chatId, "⏳ Session expired due to 10 minutes of inactivity.");
        cleanupSession(chatId);
      }, 10 * 60 * 1000);
      
      return; // Stop here, wait for user callback
    } catch (error: any) {
       await bot.sendMessage(chatId, `❌ Error moving to next step:\n${error.message}\n\n📸 Taking debug screenshot...`);
       try {
           const errImg = await page.screenshot({ timeout: 15000, type: 'jpeg', quality: 40 });
           await bot.sendPhoto(chatId, errImg, { caption: "Debug screenshot of the error state." });
       } catch (e) {}
    }
}
