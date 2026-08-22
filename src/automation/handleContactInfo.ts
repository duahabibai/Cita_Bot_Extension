import { bot, activeSessions, cleanupSession, persistSessionState } from "../botContext.js";

export async function handleContactInfo(chatId: number, queryId: string, phone: string, email: string) {
    const session = activeSessions.get(chatId);
    if (!session) {
      await bot.sendMessage(chatId, "⚠️ Session expired. Please click 'Launch Cloud Browser' again.");
      if (queryId) await bot.answerCallbackQuery(queryId).catch(() => {});
      return;
    }
    const { page } = session;

    await bot.sendMessage(chatId, `🔄 Autofilling contact info with Phone: ${phone} and Email: ${email}...`);
    if (queryId) await bot.answerCallbackQuery(queryId).catch(() => {});
    
    try {
        await page.evaluate((data: any) => {
            const setVal = (sel: string, val: string) => {
                const el = document.querySelector(sel) as HTMLInputElement;
                if (el && val) {
                    el.value = val;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            };
            
            // Typical selectors for phone, email, repeat email
            setVal('#txtTelefonoMac', data.phone);
            setVal('#txtTelefono', data.phone);
            setVal('input[type="tel"]', data.phone);
            setVal('input[name="txtTelefonoMac"]', data.phone);
            
            setVal('#txtCorreoElectronico', data.email);
            setVal('#email', data.email);
            // First Email Field
            setVal('input[type="email"]:not([id*="DOS"])', data.email);
            setVal('input[name="txtCorreoElectronico"]', data.email);
            setVal('#email', data.email);
            
            // Second (Repeat) Email Field with exact IDs provided
            setVal('#emailDOS', data.email);
            setVal('input[name="emailDOS"]', data.email);
            
            // Old fallback just in case
            setVal('#txtRepiteCorreoElectronico', data.email);
            setVal('input[name="txtRepiteCorreoElectronico"]', data.email);
            
            // Also explicitly find element by id and set it
            const emailDosEl = document.getElementById('emailDOS') as HTMLInputElement;
            if (emailDosEl) {
                emailDosEl.value = data.email;
                emailDosEl.dispatchEvent(new Event('input', { bubbles: true }));
                emailDosEl.dispatchEvent(new Event('change', { bubbles: true }));
            }

        }, { phone, email });
        
        await bot.sendMessage(chatId, "✅ Contact data filled. Adding human delay before clicking Next...");
        
        await page.waitForTimeout(Math.floor(Math.random() * 1500) + 1000); // 1-2.5 sec delay
        
        const preUrl = page.url();
        const btnSelector = '#btnSiguiente, input[value="Next "], input[value="Siguiente"], input[name="btnSiguiente"]';
        
        // Try clicking "Siguiente"
        await page.evaluate((sel: string) => {
            const btns = Array.from(document.querySelectorAll('input, button, a'));
            for (const btn of btns) {
                const txt = (btn.textContent || (btn as HTMLInputElement).value || '').toLowerCase();
                if (txt.includes('siguiente') || txt.includes('continuar')) {
                    (btn as HTMLElement).click();
                    return;
                }
            }
            // fallback generic selector
            const specific = document.querySelector(sel) as HTMLElement;
            if (specific) specific.click();
        }, btnSelector);

        await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => {});

        // Fallback click
        if (page.url() === preUrl) {
            await page.click(btnSelector).catch(() => {});
            await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => {});
        }

        await bot.sendMessage(chatId, "📸 Next page (Page 8) loaded! Taking screenshot...");
        await page.waitForTimeout(3000); // Give it time to render
        
        const nextScreenshot = await page.screenshot({
            timeout: 30000,
            animations: 'disabled',
            type: 'jpeg',
            quality: 40
        });
        await bot.sendPhoto(chatId, nextScreenshot, { caption: "✅ Next page reached! Here is the screen:" });

        await persistSessionState(chatId);
        
        // Reset timeout
        clearTimeout(session.timeoutId);
        session.timeoutId = setTimeout(async () => {
            await bot.sendMessage(chatId, "⏳ Session expired due to 10 minutes of inactivity.");
            cleanupSession(chatId);
        }, 10 * 60 * 1000);

    } catch (error: any) {
        await bot.sendMessage(chatId, `❌ Error filling contact info:\\n${error.message}`);
    }
}
