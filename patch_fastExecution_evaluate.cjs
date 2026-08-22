const fs = require('fs');
let code = fs.readFileSync('src/fastmode/fastExecution.ts', 'utf8');

const regex = /\/\/ 3\. Entrar Page \(Information\)[\s\S]*?\/\/ 7\. Arrival at Captcha \/ Date selection/g;

const robustLogic = `// 3. Entrar Page (Information)
    await bot.sendMessage(chatId, "⏩ Bypassing Information Page...");
    await page.waitForLoadState('domcontentloaded');
    
    // Evaluate-based Entrar
    const preUrlEntrar = page.url();
    await page.evaluate(() => {
        const btnEntrar = document.querySelector('#btnEntrar') as HTMLElement;
        if (btnEntrar) btnEntrar.click();
    });
    
    // 4. Form Fill (NIE, Name)
    await bot.sendMessage(chatId, "📝 Filling NIE & Name...");
    await page.waitForSelector('#txtIdCitante, #btnEntrar', { timeout: 30000 }).catch(() => {});
    
    // Check if we are still on Entrar page, if so click again
    await page.evaluate(() => {
        const btnEntrar = document.querySelector('#btnEntrar') as HTMLElement;
        if (btnEntrar) btnEntrar.click();
    });
    await page.waitForSelector('#txtIdCitante', { timeout: 30000 }).catch(() => {});

    await page.evaluate((data: any) => {
        const setVal = (sel: string, val: string) => {
            const el = document.querySelector(sel) as HTMLInputElement;
            if (el && val) {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };
        const radioId = document.querySelector('input[value="NIE"]') as HTMLInputElement;
        if (radioId) radioId.checked = true;
        setVal('#txtIdCitante', data.nie);
        setVal('#txtDesCitante', data.name);
    }, { nie: state.nie, name: state.name });

    await humanDelay(page);
    
    const preUrlNie = page.url();
    await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('input, button, a'));
        for (const btn of btns) {
            const txt = (btn.textContent || (btn as HTMLInputElement).value || '').toLowerCase();
            if (txt.includes('aceptar') || txt.includes('enviar') || txt.includes('siguiente')) {
                (btn as HTMLElement).click();
                return;
            }
        }
        // fallback
        const specific = document.querySelector('#btnEnviar, #btnSiguiente, input[value="Siguiente"]') as HTMLElement;
        if (specific) specific.click();
    });

    await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => {});
    if (page.url() === preUrlNie) {
        await page.click('#btnEnviar, #btnSiguiente, input[value="Siguiente"], input[name="btnSiguiente"]').catch(() => {});
        await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => {});
    }

    // 5. Solicitar Cita Page (Action buttons)
    await bot.sendMessage(chatId, "⏩ Clicking 'Solicitar Cita'...");
    
    const preUrlCita = page.url();
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

    await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => {});
    if (page.url() === preUrlCita) {
        await page.click('#btnEnviar, input[value="Solicitar Cita"], input[name="btnEnviar"]').catch(() => {});
        await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => {});
    }

    // 6. Contact Info Page
    await bot.sendMessage(chatId, "📞 Filling Phone & Email...");
    await page.waitForSelector('#txtTelefonoMac, #txtTelefono, input[type="tel"], input[name="txtTelefonoMac"], input[name="txtTelefonoCitante"]', { timeout: 30000 }).catch(() => {});
    
    await page.evaluate((data: any) => {
        const setVal = (sel: string, val: string) => {
            const el = document.querySelector(sel) as HTMLInputElement;
            if (el && val) {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };
        setVal('#txtTelefonoMac', data.phone);
        setVal('#txtTelefono', data.phone);
        setVal('input[type="tel"]', data.phone);
        setVal('input[name="txtTelefonoMac"]', data.phone);
        setVal('input[name="txtTelefonoCitante"]', data.phone);
        
        setVal('#txtCorreoElectronico', data.email);
        setVal('#email', data.email);
        setVal('input[type="email"]:not([id*="DOS"])', data.email);
        setVal('input[name="txtCorreoElectronico"]', data.email);
        
        setVal('#emailDOS', data.email);
        setVal('input[name="emailDOS"]', data.email);
        setVal('#txtRepiteCorreoElectronico', data.email);
        setVal('input[name="txtRepiteCorreoElectronico"]', data.email);
    }, { phone: state.phone, email: state.email });
    
    await humanDelay(page);

    const btnSelectorSiguiente = '#btnSiguiente, input[value="Next "], input[value="Siguiente"], input[name="btnSiguiente"]';
    const preUrlContact = page.url();
    
    await page.evaluate((sel: string) => {
        const btns = Array.from(document.querySelectorAll('input, button, a'));
        for (const btn of btns) {
            const txt = (btn.textContent || (btn as HTMLInputElement).value || '').toLowerCase();
            if (txt.includes('siguiente') || txt.includes('continuar')) {
                (btn as HTMLElement).click();
                return;
            }
        }
        const specific = document.querySelector(sel) as HTMLElement;
        if (specific) specific.click();
    }, btnSelectorSiguiente);
    
    await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => {});
    if (page.url() === preUrlContact) {
        await page.click(btnSelectorSiguiente).catch(() => {});
        await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => {});
    }

    // 7. Arrival at Captcha / Date selection`;

code = code.replace(regex, robustLogic);
fs.writeFileSync('src/fastmode/fastExecution.ts', code);
console.log("Successfully replaced fast Execution block!");
