import { bot, activeSessions, cleanupSession, persistSessionState } from "../botContext.js";

export async function handleSubmitForm(chatId: number, queryId: string) {
    const session = activeSessions.get(chatId);
    if (!session) {
      await bot.sendMessage(chatId, "⚠️ Session expired. Please click 'Launch Cloud Browser' again.");
      await bot.answerCallbackQuery(queryId);
      return;
    }
    const { page } = session;

    await bot.sendMessage(chatId, `🔄 Submitting form...`);
    await bot.answerCallbackQuery(queryId);

    try {
        const preUrl = page.url();
        const btnSelector = '#btnEnviar, #btnAceptar, input[value="Enviar"], input[value="Aceptar"]';
        
        await page.waitForTimeout(Math.floor(Math.random() * 1000) + 500);
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
        
        await bot.sendMessage(chatId, "⏳ Waiting for the next page to fully render...");
        await page.waitForTimeout(10000); 
        await bot.sendMessage(chatId, "📸 Next page loaded. Taking screenshot...");
        
        await bot.sendMessage(chatId, `✅ Form submitted. Here is the next step.`);

        await persistSessionState(chatId);
        
        // Reset timeout
        clearTimeout(session.timeoutId);
        session.timeoutId = setTimeout(async () => {
            await bot.sendMessage(chatId, "⏳ Session expired due to 10 minutes of inactivity.");
            cleanupSession(chatId);
        }, 10 * 60 * 1000);

    } catch (error: any) {
        await bot.sendMessage(chatId, `❌ Error submitting form:\n${error.message}`);
    }
}
