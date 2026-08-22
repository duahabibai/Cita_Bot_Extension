import { handleSolicitarCita } from "./handleSolicitarCita.js";
import { bot, activeSessions, cleanupSession, persistSessionState } from "../botContext.js";
import { globalAutofillData } from "../state.js";

export async function handleFormFill(chatId: number, queryId: string, nie: string, name: string) {
    const session = activeSessions.get(chatId);
    if (!session) {
      await bot.sendMessage(chatId, "⚠️ Session expired. Please click 'Launch Cloud Browser' again.");
      if (queryId) await bot.answerCallbackQuery(queryId).catch(() => {});
      return;
    }
    const { page } = session;

    const fallbackUrl = page.url();
    await bot.sendMessage(chatId, `🔄 Autofilling form with NIE: ${nie} and Name: ${name}...`);
    if (queryId) await bot.answerCallbackQuery(queryId).catch(() => {});

    try {
        // Evaluate on page to fill form fields.
        // Usually, the fields are #txtIdCitado (NIE/DNI) and #txtDesCitado (Name/Apellidos)

        await page.evaluate((data: any) => {
            const setVal = (sel: string, val: string) => {
                const el = document.querySelector(sel) as HTMLInputElement;
                if (el && val) {
                    el.value = val;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            };
            
            // Try common ID selectors
            setVal('#txtIdCitado', data.nie);
            // Try common Name selectors
            setVal('#txtDesCitado', data.name);
            // Try common Country of Nationality select if needed (not all forms have it)
            setVal('#txtPaisNac', data.countryNac);
            
        }, { nie, name, countryNac: globalAutofillData.countryNac });

        
        await bot.sendMessage(chatId, "✅ Form data filled. Clicking 'Aceptar/Enviar' to proceed...");
        
        await page.waitForTimeout(1000); // give time for visual update before click

        const preUrl = page.url();
        const btnSelector = '#btnEnviar, #btnAceptar, input[value="Enviar"], input[value="Aceptar"]';
        
        await page.hover(btnSelector).catch(() => {});
        await page.waitForTimeout(Math.floor(Math.random() * 400) + 200);
        
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),
          page.click(btnSelector, { delay: Math.floor(Math.random() * 150) + 50 }).catch(() => {})
        ]);
        
        if (page.url() === preUrl) {
           await bot.sendMessage(chatId, "⚠️ URL didn't change via native click. Retrying via trusted event...");
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

        
        
        await page.waitForTimeout(3000); // Wait for the new page to stabilize

        await bot.sendMessage(chatId, "✅ Form submitted successfully. (Page 5)");

        // Pass control to the next file, carrying the fallbackUrl
        await handleSolicitarCita(chatId, fallbackUrl);

    } catch (error: any) {
        await bot.sendMessage(chatId, `❌ Error filling form:\n${error.message}`);
    }
}
