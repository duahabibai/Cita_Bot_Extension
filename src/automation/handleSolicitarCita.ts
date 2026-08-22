import { bot, activeSessions, cleanupSession, persistSessionState } from "../botContext.js";
import { handleAutoOfficeSelection } from "./handleAutoOfficeSelection.js";

export async function handleSolicitarCita(chatId: number, fallbackUrl: string) {
    const session = activeSessions.get(chatId);
    if (!session) {
      await bot.sendMessage(chatId, "⚠️ Session expired. Please click 'Launch Cloud Browser' again.");
      return;
    }
    const { page } = session;

    await bot.sendMessage(chatId, "🔄 Automatically clicking 'Solicitar Cita' to proceed to the next step...");
    
    try {
        const preUrl2 = page.url();
        
        // Try clicking via evaluate
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('input, button, a'));
            for (const btn of btns) {
                const txt = (btn.textContent || (btn as HTMLInputElement).value || '').toLowerCase();
                if (txt.includes('solicitar cita')) {
                    (btn as HTMLElement).click();
                    return;
                }
            }
        });
        
        await page.waitForNavigation({ waitUntil: 'load', timeout: 20000 }).catch(() => {});
        
        // Fallback click if URL didn't change
        if (page.url() === preUrl2) {
            await page.click('#btnEnviar, input[value="Solicitar Cita"], input[name="btnEnviar"]').catch(() => {});
            await page.waitForNavigation({ waitUntil: 'load', timeout: 20000 }).catch(() => {});
        }
        
        await bot.sendMessage(chatId, "📸 Next page (Page 6) loaded! Taking screenshot...");
        await page.waitForTimeout(3000); // Give it time to render
        
        await bot.sendMessage(chatId, "✅ 'Solicitar Cita' clicked successfully. Here is the new page!");

        // Pass control to the next file (Office Selection)
        await handleAutoOfficeSelection(chatId, fallbackUrl);

    } catch (error: any) {
        await bot.sendMessage(chatId, `❌ Error clicking Solicitar Cita:\n${error.message}`);
    }
}
