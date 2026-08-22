const fs = require('fs');

let lines = fs.readFileSync('src/automation/handleTramiteSelection.ts', 'utf8');

const injection = `
      // Check if 'Entrar' button exists on the information page and click it automatically
      bot.sendMessage(chatId, "👉 Checking for 'Entrar' button on information page...");
      try {
          const entrarBtn = await page.$('#btnEntrar, input[value="Entrar"]');
          if (entrarBtn) {
              bot.sendMessage(chatId, "✅ 'Entrar' button found. Clicking to proceed to the applicant form...");
              
              const preUrl2 = page.url();
              await page.waitForTimeout(Math.floor(Math.random() * 1000) + 500);
              await page.hover('#btnEntrar, input[value="Entrar"]').catch(() => {});
              await page.waitForTimeout(Math.floor(Math.random() * 400) + 200);
              
              await Promise.all([
                  page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),
                  page.click('#btnEntrar, input[value="Entrar"]', { delay: Math.floor(Math.random() * 150) + 50 }).catch(() => {})
              ]);
              
              if (page.url() === preUrl2) {
                  bot.sendMessage(chatId, "⚠️ URL didn't change native click for 'Entrar'. Retrying via trusted event...");
                  await Promise.all([
                      page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),
                      page.evaluate((sel: string) => {
                          const el = document.querySelector(sel);
                          if (el) {
                              const evt = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
                              el.dispatchEvent(evt);
                          }
                      }, '#btnEntrar, input[value="Entrar"]').catch(() => {})
                  ]);
              }
              bot.sendMessage(chatId, "⏳ Waiting 10 seconds for the Form page to fully render...");
              await page.waitForTimeout(10000); 
          }
      } catch (e: any) {
          bot.sendMessage(chatId, \`⚠️ 'Entrar' step error (continuing anyway): \${e.message}\`);
      }
`;

lines = lines.replace('bot.sendMessage(chatId, "📸 Next page loaded. Taking screenshot...");', injection + '\n      bot.sendMessage(chatId, "📸 Next page loaded. Taking screenshot...");');

// Then add the Inline button to trigger Autofill
const sendPhotoReplacement = `
      bot.sendPhoto(chatId, screenshotBuffer, { 
          caption: \`✅ Selected Trámite: \${selectedTramite.text}\\nHere is the next page (Applicant Form).\`,
          reply_markup: {
              inline_keyboard: [
                  [{ text: "📝 Autofill Form (NIE/Name)", callback_data: "autofill_form" }]
              ]
          }
      });
`;

lines = lines.replace('bot.sendPhoto(chatId, screenshotBuffer, { caption: `✅ Selected Trámite: ${selectedTramite.text}\\nHere is the next page.` });', sendPhotoReplacement);

fs.writeFileSync('src/automation/handleTramiteSelection.ts', lines);
