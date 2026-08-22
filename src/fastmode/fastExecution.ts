import { chromium, Page } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import crypto from "crypto";
import { bot, activeSessions, PROXY_CONFIG } from "../botContext.js";
import { fastBookingStates } from "./chatState.js";

chromium.use(stealthPlugin());

async function solve2Captcha(base64Image: string, apiKey: string): Promise<string> {
    // 2Captcha requires base64 string WITHOUT the data:image/png;base64, prefix
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    
    const submitRes = await fetch('https://2captcha.com/in.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            key: apiKey,
            method: 'base64',
            body: cleanBase64,
            json: 1,
            numeric: 4, // Important: Extranjeria captchas are alphanumeric, let's allow both (0 = default, 4 = both)
            min_len: 4,
            max_len: 6
        })
    });
    const submitData = await submitRes.json();
    if (submitData.status !== 1) throw new Error("2Captcha submit error: " + submitData.request);

    const taskId = submitData.request;
    
    // Extranjeria captchas are simple, usually solved in 10-15s.
    await new Promise(r => setTimeout(r, 5000)); // Wait 5s before first poll
    
    for (let i = 0; i < 20; i++) { // Poll for up to ~60s
        const pollRes = await fetch(`https://2captcha.com/res.php?key=${apiKey}&action=get&id=${taskId}&json=1`);
        const pollData = await pollRes.json();
        if (pollData.status === 1) {
            return pollData.request;
        }
        if (pollData.request !== 'CAPCHA_NOT_READY') {
            throw new Error("2Captcha poll error: " + pollData.request);
        }
        await new Promise(r => setTimeout(r, 3000)); // poll every 3 seconds
    }
    throw new Error("2Captcha timeout");
}

async function humanDelay(page: Page) {
  await page.waitForTimeout(Math.floor(Math.random() * 800) + 400);
}

export async function executeFastLaunch(chatId: number) {
  const state = fastBookingStates.get(chatId);
  if (!state || !state.province || !state.nie || !state.name || !state.phone || !state.email) {
    await bot.sendMessage(chatId, "⚠️ Incomplete data. Cannot launch fast mode.");
    return;
  }

  await bot.sendMessage(chatId, "🚀 Starting Auto-Pilot...\nInitializing stealth browser with proxy...");
  
  let browser;
  try {
    const sessionStr = crypto.randomBytes(8).toString('hex');
    const randomPassword = `${PROXY_CONFIG.password}_session-${sessionStr}`;
    
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      proxy: {
        server: PROXY_CONFIG.server,
        username: PROXY_CONFIG.username,
        password: randomPassword
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'es-ES,es;q=0.9',
      timezoneId: 'Europe/Madrid'
    });

    const page = await context.newPage();
    
    // Save to activeSessions so standard logic can take over later
    activeSessions.set(chatId, {
      browser,
      context,
      page,
      step: 'fast_execution',
      lastInteraction: Date.now()
    });

    await bot.sendMessage(chatId, "🌍 Navigating to Extranjería...");
    await page.goto("https://icp.administracionelectronica.gob.es/icpplus/index.html", { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 1. Select Province
    await page.waitForSelector('select#form', { timeout: 10000 });
    await humanDelay(page);
    await page.selectOption('select#form', state.province.value);
    await humanDelay(page);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      page.click('#btnAceptar')
    ]);

    // 2. Select Office & Tramite
    await bot.sendMessage(chatId, `🏢 Injecting Office & Tramite for ${state.province.text}...`);
    
    if (state.office && state.office.value && state.office.value !== "99") {
       try {
           await page.waitForSelector('select#sede', { timeout: 5000 });
           await humanDelay(page);
           await page.selectOption('select#sede', state.office.value);
               await page.waitForTimeout(2000); // Allow ajax reload of tramites
       } catch(e) {
           console.log("Sede dropdown not found or changed.");
       }
    }
    
    if (state.tramite && state.tramite.value && state.tramite.value !== "-1") {
       try {
           // We might need to find which select it belongs to. Wait for select with name starting with tramite
           const selects = await page.$$('select[name^="tramite"]');
           for (const sel of selects) {
               const html = await sel.innerHTML();
               if (html.includes(`value="${state.tramite.value}"`) || html.includes(`value='${state.tramite.value}'`)) {
                       await sel.selectOption(state.tramite.value);
                       break;
                   }
           }
       } catch(e) {
           console.log("Tramite dropdown issue.");
       }
    }

    await humanDelay(page);
    const preUrlAceptar = page.url();
    await page.evaluate(() => {
        const btn = document.querySelector('#btnAceptar') as HTMLElement;
        if (btn) btn.click();
    });
    await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => {});
    if (page.url() === preUrlAceptar) {
        await page.click('#btnAceptar').catch(() => {});
        await page.waitForSelector('#btnEntrar, #txtIdCitante', { timeout: 30000 }).catch(() => {});
    }

    // 3. Entrar Page (Information)
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
    await page.waitForSelector('#txtIdCitante, #txtIdCitado, #btnEntrar', { timeout: 15000 }).catch(() => {});
    
    // Check if we are still on Entrar page, if so click again
    await page.evaluate(() => {
        const btnEntrar = document.querySelector('#btnEntrar') as HTMLElement;
        if (btnEntrar) btnEntrar.click();
    });
    await page.waitForSelector('#txtIdCitante, #txtIdCitado', { timeout: 15000 }).catch(() => {});

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
        setVal('#txtIdCitado', data.nie);
        setVal('#txtDesCitante', data.name);
        setVal('#txtDesCitado', data.name);
        setVal('input[name="txtDesCitante"]', data.name);
        setVal('input[name="txtDesCitado"]', data.name);
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

    await bot.sendMessage(chatId, "📞 Filling Phone & Email...");
    await page.waitForSelector('#txtTelefonoMac, #txtTelefono, input[type="tel"], input[name="txtTelefonoMac"], input[name="txtTelefonoCitante"], input[name="txtTelefonoCitado"]', { timeout: 15000 }).catch(() => {});
    
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
        setVal('input[name="txtTelefonoCitado"]', data.phone);
        
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

    // 7. Arrival at Captcha / Date selection
    await humanDelay(page);
    
    // Check if error
    const noAppointments = await page.locator('text="En este momento no hay citas disponibles"').count();
    if (noAppointments > 0) {
        await bot.sendMessage(chatId, "❌ No hay citas disponibles (No appointments available right now). Session will close.");
        activeSessions.delete(chatId);
        await browser.close();
        return;
    }

    // --- DATE RANGE LOGIC ---
    try {
        const calMod = await import('../automation/dateCalendarMenu.js');
        const dState = calMod.dateRangeState.get(chatId);
        
        if (dState && dState.startDate && dState.endDate) {
            await bot.sendMessage(chatId, `🔍 Searching for dates between ${dState.startDate.toISOString().split('T')[0]} and ${dState.endDate.toISOString().split('T')[0]}...`);
            
            // Pass the range to the browser
            const startStr = dState.startDate.toISOString().split('T')[0];
            const endStr = dState.endDate.toISOString().split('T')[0];
            
            const matchFound = await page.evaluate(({ start, end }) => {
                const startDate = new Date(start);
                const endDate = new Date(end);
                
                // Get current month/year from calendar header (e.g. "Agosto 2026")
                const header = document.querySelector('.ui-datepicker-title');
                if (!header) return false;
                
                const monthText = header.querySelector('.ui-datepicker-month')?.textContent?.trim().toLowerCase();
                const yearText = header.querySelector('.ui-datepicker-year')?.textContent?.trim();
                
                if (!monthText || !yearText) return false;
                
                const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
                const monthIdx = months.indexOf(monthText);
                const year = parseInt(yearText, 10);
                
                // Find all clickable days
                const days = Array.from(document.querySelectorAll('.ui-datepicker-calendar td[data-handler="selectDay"] a'));
                
                for (const dayEl of days) {
                    const day = parseInt(dayEl.textContent?.trim() || "0", 10);
                    if (day > 0) {
                        const dateObj = new Date(year, monthIdx, day);
                        
                        // Check if in range
                        if (dateObj >= startDate && dateObj <= endDate) {
                            (dayEl as HTMLElement).click(); // Click the date
                            return true;
                        }
                    }
                }
                return false;
            }, { start: startStr, end: endStr });
            
            if (matchFound) {
                await bot.sendMessage(chatId, "✅ Found a date in your range! Selected it.");
            } else {
                await bot.sendMessage(chatId, "⚠️ No dates found in your requested range. Defaulting to first available.");
                // FALLBACK: Click the first available date
                await page.evaluate(() => {
                    const firstAvailableDay = document.querySelector('.ui-datepicker-calendar td[data-handler="selectDay"] a');
                    if (firstAvailableDay) {
                        (firstAvailableDay as HTMLElement).click();
                    }
                });
            }

            // Important: Wait 5 seconds after selecting the date
            await bot.sendMessage(chatId, "⏳ Waiting 5 seconds after selecting date...");
            await page.waitForTimeout(5000);

            // --- 2CAPTCHA INITIATION & SUBMIT ---
            // Grabbing captcha AFTER clicking date, since date click might refresh the captcha
            const apiKey2Captcha = "f1a54d48c9e0ebf667fd90f29117deca";
            let captchaSuccess = false;
            try {
                await bot.sendMessage(chatId, "🤖 Grabbing Captcha image & sending to 2Captcha...");
                const imgLocator = page.locator('img[alt="captcha" i], img.img-thumbnail, #captcha').first();
                await imgLocator.waitFor({ state: 'visible', timeout: 8000 });
                
                const imgSrc = await imgLocator.evaluate((el: HTMLImageElement) => el.src);
                let base64Data = "";
                
                if (imgSrc && imgSrc.startsWith('data:image')) {
                    base64Data = imgSrc; 
                } else {
                    const imgBuffer = await imgLocator.screenshot({ type: 'jpeg', quality: 100 });
                    base64Data = imgBuffer.toString('base64');
                }
                
                await bot.sendMessage(chatId, "⏳ Waiting for 2Captcha to finish solving (usually 10-15 seconds)...");
                const captchaText = await solve2Captcha(base64Data, apiKey2Captcha);
                await bot.sendMessage(chatId, `✅ 2Captcha Solved: ${captchaText}. Filling form...`);

                // Fill Captcha
                await page.evaluate((text) => {
                    const inputSelectors = [
                        'input[placeholder*="texto" i]',
                        'input[placeholder*="captcha" i]',
                        '#txtCaptcha', '#txtCodigoSeguridad', 'input[name="txtCaptcha"]', 'input[name="captcha"]'
                    ];
                    let foundInput = null;
                    for (const sel of inputSelectors) {
                        const el = document.querySelector(sel) as HTMLInputElement;
                        if (el) {
                            foundInput = el;
                            break;
                        }
                    }
                    if (!foundInput) {
                        const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
                        foundInput = inputs.find(i => !(i as HTMLInputElement).value && i.closest('form')) as HTMLInputElement;
                    }
                    if (foundInput) {
                        foundInput.value = text;
                        foundInput.dispatchEvent(new Event('input', { bubbles: true }));
                        foundInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }, captchaText);
                captchaSuccess = true;
                
                await bot.sendMessage(chatId, "⏳ Waiting 5 seconds after filling captcha...");
                await page.waitForTimeout(5000);
                
            } catch (e: any) {
                console.error("Captcha error:", e);
                await bot.sendMessage(chatId, `⚠️ Auto-solve failed: ${e.message}`);
            }
            // ---------------------------

            // --- LIBRE TIME & CHECKBOX LOGIC ---
            await bot.sendMessage(chatId, "⏩ Selecting 'LIBRE' time...");
            await page.evaluate(() => {
                // 1. Cookies "Acepto" button (If the banner is covering the screen)
                const cookieBtns = Array.from(document.querySelectorAll('a, button, input'));
                for (const btn of cookieBtns) {
                    const txt = (btn.textContent || (btn as HTMLInputElement).value || '').trim().toLowerCase();
                    if (txt === 'acepto' || txt === 'aceptar') {
                        (btn as HTMLElement).click();
                    }
                }

                // 2. Check 'Acepto' checkbox (Privacy policy, if it exists)
                const chk = document.querySelector('input[name="chkInfoAdicional"]') as HTMLInputElement;
                if (chk && !chk.checked) chk.click();

                // 3. Find and select first "LIBRE" time
                // Based on the real HTML, LIBRE times are anchor tags with text 'LIBRE' and an ID like 'HUECO...'
                // They also have an onclick handler: onclick="confirmarHueco(this,7910096)"
                const allLinks = Array.from(document.querySelectorAll('a'));
                for (const link of allLinks) {
                    const text = (link.textContent || '').trim().toUpperCase();
                    if (text === 'LIBRE' || (link.id && link.id.startsWith('HUECO'))) {
                        // Found a LIBRE link! Click it.
                        link.click();
                        return; // Stop after clicking the first one
                    }
                }
                
                // Fallback: If no anchor tag found, try any element with 'LIBRE'
                const allElements = document.querySelectorAll('button, span, td, div[role="button"]');
                for (const el of Array.from(allElements)) {
                    const text = (el.textContent || '').trim().toUpperCase();
                    if (text === 'LIBRE') {
                        (el as HTMLElement).click();
                        return;
                    }
                }

            });
            
            await bot.sendMessage(chatId, "⏳ Waiting 5 seconds after clicking 'LIBRE' time...");
            await page.waitForTimeout(5000);
            // -----------------------------------------------------------------------------
            
            // --- POPUP CONFIRMATION (Sí) ---
            // The site shows a modal asking "¿Estás seguro?" when a time is clicked.
            await bot.sendMessage(chatId, "⏩ Clicking 'Sí' or 'Ci' on the confirmation popup...");
            await page.evaluate(() => {
                const confirmBtns = Array.from(document.querySelectorAll('.jconfirm-buttons button'));
                for (const btn of confirmBtns) {
                    const txt = (btn.textContent || '').trim().toLowerCase();
                    // Catch 'sí', 'si', 'ci', or any case variation
                    if (txt === 'sí' || txt === 'si' || txt === 'ci' || txt === 'yes') {
                        (btn as HTMLElement).click();
                        return;
                    }
                }
            });
            // --------------------------------
            
            // --- FINAL SUBMIT ---
            if (captchaSuccess) {
                await bot.sendMessage(chatId, "⏳ Waiting 8 seconds for the next page to load...");
                await page.waitForTimeout(8000);

                // FINAL CONFIRMATION PAGE LOGIC (Extracted to separate file)
                const { processFinalConfirmation } = await import('./finalConfirmation.js');
                await processFinalConfirmation(page, chatId, bot);

                const finalBuffer = await page.screenshot({ fullPage: true });
                await bot.sendPhoto(chatId, finalBuffer, { caption: "🎉 Action Completed! Final Receipt screenshot:" });
            } else {
                const buffer = await page.screenshot({ fullPage: true });
                await bot.sendPhoto(chatId, buffer, { caption: "⚠️ Stopped at Captcha page (Auto-solve failed). Session remains open." });
            }

        }
    } catch(e) {
        console.error("Date logic error:", e);
    }
    // ------------------------

    const session = activeSessions.get(chatId);
    if (session) {
        session.timeoutId = setTimeout(async () => {
            await bot.sendMessage(chatId, "⏳ Session expired due to 10 minutes of inactivity.");
            const { cleanupSession } = await import('../botContext.js');
            cleanupSession(chatId);
        }, 10 * 60 * 1000);
    }

  } catch (err: any) {
    console.error("Fast Execution Error:", err);
    await bot.sendMessage(chatId, `❌ Error during Auto-Pilot: ${err.message}`);
    if (browser) await browser.close();
    activeSessions.delete(chatId);
  }
}
