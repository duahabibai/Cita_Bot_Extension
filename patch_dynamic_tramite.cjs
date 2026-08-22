const fs = require('fs');
let code = fs.readFileSync('src/automation/handleTramiteSelection.ts', 'utf8');

const targetStr = `      await bot.sendMessage(chatId, "⏳ Waiting 10 seconds for the next page to fully render via proxy...");
      await page.waitForTimeout(10000);`;

const newCode = `      await bot.sendMessage(chatId, "⏳ Waiting 8 seconds for the next page to fully render via proxy...");
      await page.waitForTimeout(8000);

      await bot.sendMessage(chatId, "🔍 Scraping available actions/buttons on this page (like Cl@ve, Entrar, etc.)...");
      
      const dynamicButtons = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('input[type="submit"], input[type="button"], button, .boton, .btn, a.btn'));
          return btns.map((btn, index) => {
              const el = btn;
              let text = el.innerText || el.value || el.textContent || 'Action';
              text = text.trim().replace(/\\s+/g, ' ');
              let selector = '';
              if (el.id) {
                  selector = '#' + el.id;
              } else if (el.name) {
                  selector = el.tagName.toLowerCase() + '[name="' + el.name + '"]';
              } else {
                  el.setAttribute('data-bot-id', 'btn-' + index);
                  selector = '[data-bot-id="btn-' + index + '"]';
              }
              return { text: text.substring(0, 35), selector, index };
          }).filter(b => b.text.length > 1);
      });
      
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
          caption: \`✅ Selected Trámite: \${selectedTramite.text}\\nHere is the intermediate page. Please select the next action (e.g. Cl@ve, Entrar):\`,
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
`;

// Replace from 'Waiting 10 seconds...' until the end of the try block.
const splitIndex = code.indexOf(targetStr);
const endTryIndex = code.lastIndexOf('} catch (error: any) {');
if (splitIndex !== -1 && endTryIndex !== -1) {
    const finalCode = code.substring(0, splitIndex) + newCode + '    ' + code.substring(endTryIndex);
    fs.writeFileSync('src/automation/handleTramiteSelection.ts', finalCode);
    console.log("Patched successfully");
} else {
    console.log("Failed to patch, couldn't find split strings.");
}
