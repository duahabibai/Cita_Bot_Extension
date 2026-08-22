import { bot, activeSessions, cleanupSession, persistSessionState } from "../botContext.js";
import { isClaveButton, handleClaveAuthCheck, handleClaveClickWithCert } from "../clave/handleClaveAuth.js";

export async function handleDynamicClick(chatId: number, queryId: string, index: number) {
    const session = activeSessions.get(chatId);
    if (!session) {
      await bot.sendMessage(chatId, "⚠️ Session expired. Please click 'Launch Cloud Browser' again.");
      await bot.answerCallbackQuery(queryId);
      return;
    }

    const { page, dynamicButtons } = session;
    const selectedBtn = dynamicButtons?.find(b => b.index === index);

    if (!selectedBtn) {
       await bot.sendMessage(chatId, "⚠️ Invalid button selection.");
       await bot.answerCallbackQuery(queryId);
       return;
    }

    await bot.sendMessage(chatId, `🔄 Clicking button: '${selectedBtn.text}'...`);
    await bot.answerCallbackQuery(queryId);

    if (isClaveButton(selectedBtn.text)) {
      console.log("[CLAVE] Detected Cl@ve button, initiating authentication flow");
      const intercepted = await handleClaveAuthCheck(chatId, queryId, async () => {
        console.log("[CLAVE] Certificate and password ready, calling handleClaveClickWithCert");
        await handleClaveClickWithCert(chatId, selectedBtn.selector);
      });
      // If intercepted (prompting for cert/password), return immediately
      if (intercepted) {
        console.log("[CLAVE] Intercepted - waiting for cert/password upload");
        return;
      }
      // If not intercepted, the callback was executed (cert auth completed)
      // Return here to prevent normal click logic from running
      console.log("[CLAVE] Authentication flow completed, returning without normal click");
      return;
    }

    try {
      const preUrl = page.url();
      
      await page.hover(selectedBtn.selector).catch(() => {});
      await page.waitForTimeout(Math.floor(Math.random() * 400) + 200);

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),
        page.click(selectedBtn.selector, { delay: Math.floor(Math.random() * 150) + 50 }).catch(() => {})
      ]);
      
      if (page.url() === preUrl) {
         await bot.sendMessage(chatId, "⚠️ URL didn't change via native click. Retrying via trusted event...");
         await Promise.all([
           page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),
           page.evaluate((sel: string) => {
               const el = document.querySelector(sel);
               if (el) {
                   el.click();
                   const evt = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
                   el.dispatchEvent(evt);
               }
           }, selectedBtn.selector).catch(() => {})
         ]);
      }

      await bot.sendMessage(chatId, "⏳ Waiting 8 seconds for the new page to render...");
      await page.waitForTimeout(8000);

      await bot.sendMessage(chatId, "🔍 Scraping available actions/buttons on this new page...");
      
      
      // Scroll to bottom so screenshot shows the buttons
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      
      const newDynamicButtons = await page.evaluate(() => {
          
          
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
      
      session.dynamicButtons = newDynamicButtons;
      
      await bot.sendMessage(chatId, "📸 Next page loaded. Taking screenshot...");
      const screenshotBuffer = await page.screenshot({
        timeout: 30000,
        animations: 'disabled',
        type: 'jpeg',
        quality: 40
      });
      
      const inline_keyboard = [];
      
      if (newDynamicButtons && newDynamicButtons.length > 0) {
          newDynamicButtons.forEach(btn => {
              inline_keyboard.push([{ text: "🖱️ " + btn.text, callback_data: "dyn_" + btn.index }]);
          });
      }
      
      inline_keyboard.push([{ text: "📝 Autofill Form (NIE/Name) [Fallback]", callback_data: "autofill_form" }]);

      await bot.sendPhoto(chatId, screenshotBuffer, { 
          caption: `✅ Clicked: ${selectedBtn.text}\
\nHere is the new page. You can continue clicking buttons, or proceed to Autofill if it's the right page:`,
          reply_markup: { inline_keyboard }
      });
      
      await persistSessionState(chatId);
      
      // Reset timeout
      clearTimeout(session.timeoutId);
      session.timeoutId = setTimeout(async () => {
        await bot.sendMessage(chatId, "⏳ Session expired due to 10 minutes of inactivity.");
        cleanupSession(chatId);
      }, 10 * 60 * 1000);

    } catch (error: any) {
       await bot.sendMessage(chatId, `❌ Error during click:\
\${error.message}\
\
📸 Taking debug screenshot...`);
       try {
           const errImg = await page.screenshot({ timeout: 15000, type: 'jpeg', quality: 40 });
           await bot.sendPhoto(chatId, errImg, { caption: "Debug screenshot of the error state." });
       } catch (e) {}
    }
}
