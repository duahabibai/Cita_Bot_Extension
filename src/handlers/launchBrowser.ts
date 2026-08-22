import crypto from "crypto";
import path from "path";
import fs from "fs";
import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
chromium.use(stealthPlugin());

import { bot, activeSessions, cleanupSession, persistSessionState, PROXY_CONFIG } from "../botContext.js";
import { hasCustomScript } from "./handleCustomScript.js";

export async function handleLaunchBrowser(chatId: number, isRetry = false) {
  if (!isRetry) {
      await bot.sendMessage(chatId, "⏳ Launching Cloud Browser (Checking for existing session)...");
  } else {
      await bot.sendMessage(chatId, "♻️ IP/Session blocked! Auto-recovering: Deleted bad session, getting a fresh proxy...");
  }
  
  cleanupSession(chatId);

  let browser;
  try {
    const sessionStr = crypto.randomBytes(8).toString('hex');
    const randomPassword = `${PROXY_CONFIG.password}_session-${sessionStr}`;
    
    browser = await chromium.launch({
      headless: true,
      ignoreDefaultArgs: ["--enable-automation"],
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      proxy: {
        server: PROXY_CONFIG.server,
        username: PROXY_CONFIG.username,
        password: randomPassword
      }
    });

    const sessionFilePath = path.resolve(`./sessions/${chatId}.json`);
    
    const contextOptions: any = {
      locale: 'es-ES',
      timezoneId: 'Europe/Madrid',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      extraHTTPHeaders: {
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
      }
    };

    // --- PLAN B: AUTO-RECOVERY LOGIC ---
    let usingOldSession = false;
    if (!isRetry && fs.existsSync(sessionFilePath)) {
        contextOptions.storageState = sessionFilePath;
        usingOldSession = true;
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    // Enhanced bot detection evasion
    await page.addInitScript(() => {
      // Override the navigator.webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // Override the Permissions API
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: 'denied' } as PermissionStatus) :
          originalQuery(parameters)
      );

      // Add missing chrome properties
      (window as any).chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {},
      };

      // Override plugins to look more real
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['es-ES', 'es', 'en-US', 'en'],
      });
    });

    if (!isRetry) await bot.sendMessage(chatId, "🌐 Browser opened! Navigating to Extranjería...");

    // Add extra time and a retry wrapper for unstable proxies
    try {
        await page.goto('https://sede.administracionespublicas.gob.es/pagina/index/directorio/icpplus', {
          waitUntil: 'domcontentloaded',
          timeout: 120000
        });

        // Wait additional time for anti-bot JavaScript to complete
        await bot.sendMessage(chatId, "⏳ Waiting for page to fully load (anti-bot checks)...");
        await page.waitForTimeout(5000);

    } catch(e: any) {
        if (e.message.includes('ERR_TUNNEL_CONNECTION_FAILED')) {
            await bot.sendMessage(chatId, "⚠️ Proxy error detected (ERR_TUNNEL_CONNECTION_FAILED). Trying to reconnect with a different node in 5 seconds...");
            await page.waitForTimeout(5000);
            await page.goto('https://sede.administracionespublicas.gob.es/pagina/index/directorio/icpplus', {
              waitUntil: 'domcontentloaded',
              timeout: 120000
            });
            await page.waitForTimeout(5000);
        } else {
            throw e;
        }
    }


    const pageText = await page.evaluate(() => document.body.innerText || '');
    const currentUrl = page.url();

    // Check if we landed on bot detection page
    if (currentUrl.includes('/icpplus/index.html') || pageText.includes('window.SpaB')) {
        await bot.sendMessage(chatId, "🤖 Bot detection page detected. Waiting for redirect...");
        console.log('[LAUNCH] Bot detection page detected, waiting 10 seconds...');

        // Wait for automatic redirect after bot check
        await page.waitForTimeout(10000);

        // Check if we're still on bot detection page
        const urlAfterWait = page.url();
        if (urlAfterWait.includes('/icpplus/index.html')) {
            await bot.sendMessage(chatId, "⚠️ Still on bot detection page. Trying to navigate manually...");
            console.log('[LAUNCH] Still on bot page, manually navigating to form page...');

            // Try to navigate to the form page directly
            try {
                await page.goto('https://icp.administracionelectronica.gob.es/icpplus/citar', {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });
                await page.waitForTimeout(3000);
            } catch (navError: any) {
                console.log('[LAUNCH] Direct navigation failed:', navError.message);
            }
        }
    }

    // Additional checks for error states
    if (pageText.includes('vuelva a intentarlo más tarde') || pageText.includes('ERROR [503]') || pageText.includes('Forbidden')) {
        if (usingOldSession) {
            // Delete poisoned cookie and retry automatically
            if (fs.existsSync(sessionFilePath)) fs.unlinkSync(sessionFilePath);
            await browser.close().catch(() => {});
            return handleLaunchBrowser(chatId, true); // Recursive retry
        } else {
            throw new Error("WAF 503 Error Hit even on a fresh IP. Please wait a bit and try again.");
        }
    }
    // ------------------------------------

    // Dismiss cookies if present
    try {
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button, a, input'));
            for (const btn of btns) {
                const txt = (btn.textContent || (btn as HTMLInputElement).value || '').toLowerCase();
                if (txt.includes('aceptar cookie') || txt.includes('entendido')) {
                    (btn as HTMLElement).click();
                }
            }
        });
        await page.waitForTimeout(1000);
    } catch (e) {}

    await bot.sendMessage(chatId, "👉 Checking if '#submit' button exists...");

    try {
      const buttonElement = await page.$('#submit');
      if (buttonElement) {
        await bot.sendMessage(chatId, "👉 Button found! Adding human delay before clicking...");
        await page.waitForTimeout(Math.floor(Math.random() * 1500) + 2000); // 2-3.5 seconds delay
        
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),
          page.click('#submit', { delay: Math.floor(Math.random() * 100) + 50 }).catch(() => {})
        ]);

        // Check for 403 Forbidden or 503 after submitting
        const postSubmitText = await page.evaluate(() => document.body.innerText || '');
        if (postSubmitText.includes('Forbidden') || postSubmitText.includes('vuelva a intentarlo') || postSubmitText.includes('ERROR [503]')) {
            if (true) { // Always force a new session on 403
                if (fs.existsSync(sessionFilePath)) fs.unlinkSync(sessionFilePath);
                await browser.close().catch(() => {});
                return handleLaunchBrowser(chatId, true);
            } else {
                throw new Error("WAF 403/503 Error Hit even on a fresh IP after submit. Please wait a bit and try again.");
            }
        }
      }
    } catch (err: any) {}



    await bot.sendMessage(chatId, "⏳ Waiting for province dropdown...");
    
    try {
       await page.waitForSelector('select#form', { timeout: 30000 });
    } catch (e) {
       // Deep check for Forbidden before giving up
       const isForbidden = await page.evaluate(() => document.body && document.body.innerText.includes('Forbidden'));
       if (isForbidden) {
            if (usingOldSession) {
                if (fs.existsSync(sessionFilePath)) fs.unlinkSync(sessionFilePath);
                await browser.close().catch(() => {});
                return handleLaunchBrowser(chatId, true);
            } else {
                throw new Error("WAF 403 Forbidden Error Hit on a fresh IP. IP is blocked.");
            }
       }
       
       const currentUrl = await page.url();
       const bodyHtml = await page.evaluate(() => document.body.outerHTML.substring(0, 500));
       await bot.sendMessage(chatId, "⚠️ Could not find province dropdown.\nURL: " + currentUrl + "\nBody: " + bodyHtml + "\nTaking debug screenshot...");
       try {
           const errImg = await page.screenshot({ timeout: 15000, type: 'jpeg', quality: 40 });
           await bot.sendPhoto(chatId, errImg, { caption: "Timeout state." });
       } catch (err) {}
       throw new Error("Timeout waiting for province dropdown.");
    }

    await bot.sendMessage(chatId, "🔍 Extracting page data...");

    const provinces = await page.$$eval('select#form option', (options: HTMLOptionElement[]) => {
      return options
        .map(o => ({ text: o.textContent?.trim() || '', value: o.value }))
        .filter(o => o.value !== '' && !o.text.includes('Seleccione'));
    });

    if (provinces && provinces.length > 0) {
       // --- DB SAVE INJECTION ---
       try {
           const dbPath = path.resolve('./fastmode_db.json');
           let db = { provinces: [], offices: {}, tramites: {} };
           if (fs.existsSync(dbPath)) {
               try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch(e){}
           }
           db.provinces = provinces;
           fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
       } catch (e) {
           console.error("Failed to save provinces to fast DB", e);
       }
       // -------------------------

       await bot.sendMessage(chatId, `✅ Found ${provinces.length} provinces. (Saved to Database)`);

       await bot.sendMessage(chatId, "📍 Province page loaded successfully!");

       const inlineKeyboard = [];
       for (let i = 0; i < provinces.length; i += 4) {
         const row = [];
         for (let j = 0; j < 4; j++) {
           if (provinces[i + j]) row.push({ text: provinces[i + j].text, callback_data: `prov_${i + j}` });
         }
         inlineKeyboard.push(row);
       }

       // Add custom extraction button if admin has uploaded a script
       if (hasCustomScript(chatId)) {
         inlineKeyboard.push([{ text: "🤖 Run Custom Extraction", callback_data: "run_custom_extraction" }]);
       }

       inlineKeyboard.push([{ text: "🛑 Close Browser (Save MBs)", callback_data: "close_browser" }]);

       await bot.sendMessage(chatId, "📍 Please select a province (or close browser to save MBs):", { reply_markup: { inline_keyboard: inlineKeyboard } });
       
       const timeoutId = setTimeout(async () => {
          await bot.sendMessage(chatId, "⏳ Session expired due to 10 minutes of inactivity.");
          cleanupSession(chatId);
       }, 10 * 60 * 1000);
       
       activeSessions.set(chatId, { browser, context, page, timeoutId, provinces });
       await persistSessionState(chatId); // Save successful session for next time!
    } else {
       throw new Error("No provinces found on the page.");
    }
  } catch (err: any) {
    await bot.sendMessage(chatId, `❌ Error: ${err.message}`);
    if (browser) {
      browser.close().catch(() => {});
    }
  }
}
