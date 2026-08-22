import { Page } from "playwright-extra";

export async function processFinalConfirmation(page: Page, chatId: number, bot: any) {
    await bot.sendMessage(chatId, "⏩ Automating final confirmation page...");
    try {
        await page.evaluate(async () => {
            // 1. Click the first checkbox (chkTotal)
            const chkTotal = document.querySelector('#chkTotal') as HTMLInputElement;
            if (chkTotal && !chkTotal.checked) {
                chkTotal.click();
            }
        });
        await page.waitForTimeout(1000); // Wait 1 sec

        await page.evaluate(async () => {
            // 2. Click the second checkbox (enviarCorreo)
            const enviarCorreo = document.querySelector('#enviarCorreo') as HTMLInputElement;
            if (enviarCorreo && !enviarCorreo.checked) {
                enviarCorreo.click();
            }
        });
        await page.waitForTimeout(1000); // Wait 1 sec

        // 3. Click the confirm button (btnConfirmar)
        const btnClicked = await page.evaluate(() => {
            const btnConfirmar = document.querySelector('#btnConfirmar') as HTMLElement;
            if (btnConfirmar) {
                btnConfirmar.click();
                return true;
            }
            return false;
        });
        
        if (btnClicked) {
            // Wait for the final receipt page to load after clicking confirm
            await bot.sendMessage(chatId, "⏳ Waiting for the final receipt to generate...");
            await page.waitForNavigation({ waitUntil: 'load', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(2000); // Extra buffer for render
        } else {
            await bot.sendMessage(chatId, "⚠️ Could not find the final Confirm button, taking screenshot of current state.");
        }
    } catch(err: any) {
        console.error("Final confirmation error:", err);
        await bot.sendMessage(chatId, `⚠️ Error clicking final confirm buttons: ${err.message}`);
    }
}
