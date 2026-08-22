const fs = require('fs');
let code = fs.readFileSync('src/fastmode/fastExecution.ts', 'utf8');

const officeCheck = `
    // 5.5 Check for Office Selection (#idSede)
    const hasOfficeSelect = await page.evaluate(() => !!document.querySelector('select#idSede, select[name="idSede"]'));
    if (hasOfficeSelect) {
        await bot.sendMessage(chatId, "🏢 Intercepted Office Selection step. Auto-selecting random office...");
        const selectedOfficeName = await page.evaluate(() => {
            const officeSelect = document.querySelector('select#idSede, select[name="idSede"]') as HTMLSelectElement;
            if (officeSelect) {
                const validOfficeOptions = Array.from(officeSelect.options).filter(
                    (opt) => opt.value && opt.value !== "" && opt.value !== "-1"
                );
                if (validOfficeOptions.length > 0) {
                    const randomOffice = validOfficeOptions[Math.floor(Math.random() * validOfficeOptions.length)];
                    officeSelect.value = randomOffice.value;
                    officeSelect.dispatchEvent(new Event("change", { bubbles: true }));
                    return randomOffice.text;
                }
            }
            return null;
        });
        
        await humanDelay(page);
        
        const preUrlOffice = page.url();
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('input, button, a'));
            for (const btn of btns) {
                const txt = (btn.textContent || (btn as HTMLInputElement).value || '').toLowerCase();
                if (txt.includes('siguiente') || txt.includes('continuar')) {
                    (btn as HTMLElement).click();
                    return;
                }
            }
            const specific = document.querySelector('#btnSiguiente, input[value="Siguiente"]') as HTMLElement;
            if (specific) specific.click();
        });
        
        await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => {});
        if (page.url() === preUrlOffice) {
            await page.click('#btnSiguiente, input[value="Siguiente"], input[name="btnSiguiente"]').catch(() => {});
            await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => {});
        }
    }

    // 6. Contact Info Page
`;

code = code.replace(/\/\/ 6\. Contact Info Page/g, officeCheck);
fs.writeFileSync('src/fastmode/fastExecution.ts', code);
console.log("Patched office selection");
