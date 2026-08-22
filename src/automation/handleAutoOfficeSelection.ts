import { bot, activeSessions, cleanupSession, persistSessionState } from "../botContext.js";

export async function handleAutoOfficeSelection(chatId: number, fallbackUrl: string) {
    const session = activeSessions.get(chatId);
    if (!session) {
      await bot.sendMessage(chatId, "⚠️ Session expired. Please click 'Launch Cloud Browser' again.");
      return;
    }
    const { page } = session;

    // --- AUTO-SELECT RANDOM OFFICE WITH 2x RELOAD FALLBACK ---
    await bot.sendMessage(chatId, "🔄 Checking for Office Dropdown (#idSede)...");
    
    try {
        let officeSelectFound = false;
        let selectedOfficeName = null;

        for (let attempt = 0; attempt <= 2; attempt++) {
            selectedOfficeName = await page.evaluate(() => {
                const officeSelect = document.querySelector('select#idSede, select[name="idSede"]') as HTMLSelectElement;
                if (officeSelect) {
                    const validOfficeOptions = Array.from(officeSelect.options).filter(
                        (opt) => opt.value && opt.value !== "" && opt.value !== "-1"
                    );
                    if (validOfficeOptions.length > 0 && (officeSelect.value === "" || officeSelect.value === "-1")) {
                        const randomOffice = validOfficeOptions[Math.floor(Math.random() * validOfficeOptions.length)];
                        officeSelect.value = randomOffice.value;
                        officeSelect.dispatchEvent(new Event("change", { bubbles: true }));
                        return randomOffice.text;
                    } else if (validOfficeOptions.length > 0) {
                        return officeSelect.options[officeSelect.selectedIndex].text;
                    }
                    return "EMPTY_BUT_EXISTS";
                }
                return null;
            });

            if (selectedOfficeName) {
                officeSelectFound = true;
                break; // Dropdown found, exit reload loop
            }

            if (attempt < 2) {
                await bot.sendMessage(chatId, `⚠️ Dropdown not found. Reloading page (Attempt ${attempt + 1}/2)...`);
                await page.reload({ waitUntil: 'load', timeout: 30000 }).catch(() => {});
                await page.waitForTimeout(2500); // Give it time to fully render
            }
        }

        if (officeSelectFound) {
            if (selectedOfficeName !== "EMPTY_BUT_EXISTS") {
                await bot.sendMessage(chatId, `✅ Randomly selected office: ${selectedOfficeName.trim()}. Adding human delay...`);
            }

            await page.waitForTimeout(Math.floor(Math.random() * 1500) + 1500); // 1.5 - 3 sec delay

            const preUrl3 = page.url();
            
            // Try clicking "Siguiente"
            await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('input, button, a'));
                for (const btn of btns) {
                    const txt = (btn.textContent || (btn as HTMLInputElement).value || '').toLowerCase();
                    if (txt.includes('siguiente') || txt.includes('continuar')) {
                        (btn as HTMLElement).click();
                        return;
                    }
                }
            });

            await page.waitForNavigation({ waitUntil: 'load', timeout: 20000 }).catch(() => {});

            // Fallback click
            if (page.url() === preUrl3) {
                await page.click('#btnSiguiente, input[value="Siguiente"], input[name="btnSiguiente"]').catch(() => {});
                await page.waitForNavigation({ waitUntil: 'load', timeout: 20000 }).catch(() => {});
            }

            await bot.sendMessage(chatId, "📸 Next page (Page 7) loaded! Taking screenshot...");
            await page.waitForTimeout(3000); // Give it time to render
            
            await bot.sendMessage(chatId, "✅ Office selected successfully. Reached Contact Info Page!", { 
                reply_markup: {
                    inline_keyboard: [[{ text: "📝 Fill Phone & Email", callback_data: "fill_contact" }]]
                }
            });

        } else {
            // THE FALLBACK EXECUTION
            await bot.sendMessage(chatId, "🚨 Dropdown missing after 2 reloads (Error/Clave). Executing FALLBACK logic to Saved URL...");
            
            await page.goto(fallbackUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch((e: any) => {
                console.error("Fallback error:", e);
            });
            
            await page.waitForTimeout(2000); // allow it to stabilize
            await bot.sendMessage(chatId, "🔄 Fallback successful. Returned to the saved Form URL.");
            
            await bot.sendMessage(chatId, "🔙 Returned to Form Page via Fallback.");
            
            // Return early so we don't proceed with next steps
            await persistSessionState(chatId);
            return;
        }

        await persistSessionState(chatId);
        
        // Reset timeout
        clearTimeout(session.timeoutId);
        session.timeoutId = setTimeout(async () => {
            await bot.sendMessage(chatId, "⏳ Session expired due to 10 minutes of inactivity.");
            cleanupSession(chatId);
        }, 10 * 60 * 1000);

    } catch (e: any) {
        await bot.sendMessage(chatId, `⚠️ Error during Office Selection/Fallback: ${e.message}`);
    }
}
