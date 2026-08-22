import TelegramBot from "node-telegram-bot-api";
import {
  hasSavedCert,
  hasSavedPassword,
  saveP12,
  savePassword,
  getP12Path,
  getPassword,
} from "./certManager.js";
import crypto from "crypto";
import fs from "fs";
import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import { bot, activeSessions, cleanupSession, persistSessionState, PROXY_CONFIG } from "../botContext.js";

export interface ClaveAuthState {
  step: "awaiting_p12" | "awaiting_password";
  p12Filename?: string;
}

export const claveAuthStates = new Map<number, ClaveAuthState>();

export function isClaveButton(text: string): boolean {
  const lower = text.toLowerCase();

  // CRITICAL: Exclude "Sin Cl@ve" which means "WITHOUT Cl@ve"
  // "Sin" = "Without" in Spanish
  if (lower.includes("sin cl@ve") || lower.includes("sin clave")) {
    return false;
  }

  // Only return true if it contains clave/cl@ve AND it's the authentication option
  const hasClave = lower.includes("clave") || lower.includes("cl@ve");
  const isAuthOption = lower.includes("acceder") || lower.includes("con cl") || lower.includes("con clave");

  // Return true only if it has "clave" AND is an authentication option
  // OR if it explicitly says "acceder" (access/enter)
  return hasClave && (isAuthOption || lower.includes("acceder"));
}

export async function handleClaveAuthCheck(
  chatId: number,
  queryId: string,
  callbackAfterReady: () => Promise<void>
): Promise<boolean> {
  if (!hasSavedCert(chatId)) {
    claveAuthStates.set(chatId, { step: "awaiting_p12" });
    await bot.sendMessage(
      chatId,
      "🔐 No Cl@ve certificate found for your account.\n\n" +
        "Please upload your `.p12` certificate file now.\n" +
        "You can send it as a document in this chat.",
      { parse_mode: "Markdown" }
    );
    if (queryId) await bot.answerCallbackQuery(queryId);
    return true;
  }

  if (!hasSavedPassword(chatId)) {
    claveAuthStates.set(chatId, { step: "awaiting_password" });
    await bot.sendMessage(
      chatId,
      "🔐 Certificate found. Now please reply with your Cl@ve certificate **password**:",
      { parse_mode: "Markdown" }
    );
    if (queryId) await bot.answerCallbackQuery(queryId);
    return true;
  }

  await callbackAfterReady();
  return false;
}

export async function handleClaveDocument(
  chatId: number,
  fileName: string,
  fileBuffer: Buffer
): Promise<boolean> {
  const state = claveAuthStates.get(chatId);
  if (!state || state.step !== "awaiting_p12") return false;

  if (!fileName.toLowerCase().endsWith(".p12")) {
    await bot.sendMessage(
      chatId,
      "⚠️ That doesn't look like a `.p12` file. Please upload a valid `.p12` certificate.",
      { parse_mode: "Markdown" }
    );
    return true;
  }

  saveP12(chatId, fileBuffer, fileName);
  state.step = "awaiting_password";
  state.p12Filename = fileName;

  await bot.sendMessage(
    chatId,
    `✅ Certificate **${fileName}** saved!\n\nNow please reply with your Cl@ve certificate **password**:`,
    { parse_mode: "Markdown" }
  );
  return true;
}

export async function handleClavePasswordText(
  chatId: number,
  text: string
): Promise<boolean> {
  const state = claveAuthStates.get(chatId);
  if (!state || state.step !== "awaiting_password") return false;

  savePassword(chatId, text.trim());
  claveAuthStates.delete(chatId);

  await bot.sendMessage(
    chatId,
    "✅ Cl@ve password saved and encrypted!\n\n🚀 Ready to authenticate with Cl@ve. Click **'Acceder con Cl@ve'** again to proceed.",
    { parse_mode: "Markdown" }
  );
  return true;
}

export async function handleClaveClickWithCert(chatId: number, buttonSelector: string) {
  console.log("[CLAVE] === Starting Cl@ve Authentication Flow ===");
  console.log(`[CLAVE] ChatId: ${chatId}`);

  console.log("[CLAVE] Loading certificate...");
  const cert = (() => {
    const p12 = getP12Path(chatId);
    const pw = getPassword(chatId);
    if (!p12 || !pw) {
      console.log("[CLAVE] ERROR: Certificate or password not found");
      return null;
    }
    console.log(`[CLAVE] Certificate path: ${p12}`);
    console.log("[CLAVE] Password loaded successfully");

    // Validate certificate file exists and is readable
    try {
      if (!fs.existsSync(p12)) {
        console.log(`[CLAVE] ERROR: Certificate file does not exist at path: ${p12}`);
        return null;
      }
      const stats = fs.statSync(p12);
      console.log(`[CLAVE] Certificate file size: ${stats.size} bytes`);
      if (stats.size === 0) {
        console.log("[CLAVE] ERROR: Certificate file is empty");
        return null;
      }
      // Try to read the file to ensure it's accessible
      fs.readFileSync(p12);
      console.log("[CLAVE] Certificate file validated and readable");
    } catch (err: any) {
      console.log(`[CLAVE] ERROR: Cannot read certificate file: ${err.message}`);
      return null;
    }

    console.log("[CLAVE] Password loaded successfully");
    return { p12Path: p12, password: pw };
  })();

  if (!cert) {
    console.log("[CLAVE] FAILED: Certificate or password missing");
    await bot.sendMessage(chatId, "⚠️ Certificate or password missing. Please upload them first.");
    return;
  }

  console.log("[CLAVE] Certificate loaded successfully");

  const session = activeSessions.get(chatId);
  if (!session) {
    console.log("[CLAVE] ERROR: No active session found");
    await bot.sendMessage(chatId, "⚠️ Session expired. Please launch the browser again.");
    return;
  }

  const { browser, context, page } = session;

  // The page should already be on the Cl@ve methods selection page
  // Get the current URL so we can navigate there with the certificate-enabled context
  const clavePageUrl = page.url();
  console.log("[CLAVE] Current page URL (Cl@ve methods page):", clavePageUrl);

  console.log("[CLAVE] Preparing browser with certificate-enabled context...");
  await bot.sendMessage(chatId, "🔐 Preparing browser with your Cl@ve certificate...");

  try {
    chromium.use(stealthPlugin());

    const sessionStr = crypto.randomBytes(8).toString("hex");
    const randomPassword = `${PROXY_CONFIG.password}_session-${sessionStr}`;

    // Configure certificate for all relevant Spanish government domains
    const certOrigins = [
      "https://sede.administracionespublicas.gob.es",
      "https://clave.gob.es",
      "https://valide.redsara.es",
      "https://icp.administracionelectronica.gob.es",
      "https://www.sede.administracionespublicas.gob.es",
    ];

    console.log("[CLAVE] Configuring client certificate for origins:");
    certOrigins.forEach(origin => console.log(`[CLAVE]   - ${origin}`));
    console.log("[CLAVE] Certificate file:", cert.p12Path);
    console.log("[CLAVE] Certificate password: ****** (hidden)");


    const newContext = await browser.newContext({
      proxy: {
        server: PROXY_CONFIG.server,
        username: PROXY_CONFIG.username,
        password: randomPassword,
      },
      clientCertificates: certOrigins.map(origin => ({
        origin: origin,
        pfxPath: cert.p12Path,
        passphrase: cert.password,
      })),
      ignoreHTTPSErrors: true,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "es-ES",
      timezoneId: "Europe/Madrid",
    });

    const newPage = await newContext.newPage();

    // Track all navigations
    console.log("[CLAVE] Setting up navigation tracking...");
    newPage.on('framenavigated', (frame) => {
      if (frame === newPage.mainFrame()) {
        console.log(`[CLAVE] Navigation: FROM: ${frame.url()}`);
      }
    });

    console.log("[CLAVE] Opening Cl@ve authentication page...");
    await bot.sendMessage(chatId, "🌐 Loading Cl@ve authentication page with certificate...");

    const navigationStartUrl = clavePageUrl;
    console.log(`[CLAVE] Navigation START: ${navigationStartUrl}`);

    await newPage.goto(clavePageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const navigationEndUrl = newPage.url();
    console.log(`[CLAVE] Navigation END: ${navigationEndUrl}`);
    console.log(`[CLAVE] Navigation: FROM: ${navigationStartUrl} TO: ${navigationEndUrl}`);

    console.log("[CLAVE] Page loaded, waiting for stabilization...");
    await newPage.waitForTimeout(3000); // Wait for page to stabilize

    // Declare variables early for proper scoping
    let urlBeforeAuth = navigationStartUrl;
    const urlAfterLoad = newPage.url();

    console.log("[CLAVE] ========================================");
    console.log("[CLAVE] FINAL URL:", urlAfterLoad);
    console.log("[CLAVE] Navigation complete: FROM:", navigationStartUrl, "TO:", urlAfterLoad);
    console.log("[CLAVE] ========================================");

    // === COMPREHENSIVE PAGE DIAGNOSTICS ===
    console.log("[CLAVE] DIAGNOSTIC: Inspecting page structure");
    console.log("[CLAVE] ========================================");

    const pageDiagnostics = await newPage.evaluate(() => {
      const result: any = {
        url: window.location.href,
        title: document.title,
        bodyText: document.body ? document.body.innerText.substring(0, 500) : '',
        buttons: [],
        links: [],
        forms: [],
        inputs: [],
        iframes: [],
        visibleElements: []
      };

      // Collect all buttons
      document.querySelectorAll('button').forEach((btn, idx) => {
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          result.buttons.push({
            index: idx,
            text: btn.textContent?.trim() || '',
            id: btn.id || '',
            className: btn.className || '',
            type: btn.getAttribute('type') || '',
            visible: true
          });
        }
      });

      // Collect all input buttons and submits
      document.querySelectorAll('input[type="button"], input[type="submit"]').forEach((inp, idx) => {
        const rect = inp.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          result.buttons.push({
            index: idx,
            text: (inp as HTMLInputElement).value || '',
            id: inp.id || '',
            className: inp.className || '',
            type: 'input-' + inp.getAttribute('type'),
            visible: true
          });
        }
      });

      // Collect all links
      document.querySelectorAll('a').forEach((link, idx) => {
        const rect = link.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          result.links.push({
            index: idx,
            text: link.textContent?.trim() || '',
            href: link.getAttribute('href') || '',
            id: link.id || '',
            className: link.className || ''
          });
        }
      });

      // Collect all forms
      document.querySelectorAll('form').forEach((form, idx) => {
        result.forms.push({
          index: idx,
          action: form.getAttribute('action') || '',
          method: form.getAttribute('method') || '',
          id: form.id || '',
          className: form.className || ''
        });
      });

      // Collect all input elements
      document.querySelectorAll('input').forEach((inp, idx) => {
        result.inputs.push({
          index: idx,
          type: inp.getAttribute('type') || 'text',
          name: inp.getAttribute('name') || '',
          id: inp.id || '',
          value: (inp as HTMLInputElement).value || ''
        });
      });

      // Collect iframes
      document.querySelectorAll('iframe').forEach((iframe, idx) => {
        result.iframes.push({
          index: idx,
          src: iframe.getAttribute('src') || '',
          id: iframe.id || '',
          className: iframe.className || ''
        });
      });

      // Look for any element containing certificate-related keywords
      const keywords = ['certificado', 'certificate', 'clave', 'acceder', 'entrar', 'continuar', 'siguiente', 'aceptar'];
      document.querySelectorAll('*').forEach(el => {
        const text = el.textContent?.toLowerCase().trim() || '';
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && text.length < 200) {
          for (const keyword of keywords) {
            if (text.includes(keyword)) {
              result.visibleElements.push({
                tag: el.tagName.toLowerCase(),
                text: el.textContent?.trim().substring(0, 100) || '',
                id: el.id || '',
                className: el.className || '',
                keyword: keyword
              });
              break;
            }
          }
        }
      });

      return result;
    });

    console.log("[CLAVE] Page Title:", pageDiagnostics.title);
    console.log("[CLAVE] Body Text (first 500 chars):", pageDiagnostics.bodyText);
    console.log("[CLAVE] Number of visible buttons:", pageDiagnostics.buttons.length);
    console.log("[CLAVE] Buttons:", JSON.stringify(pageDiagnostics.buttons, null, 2));
    console.log("[CLAVE] Number of visible links:", pageDiagnostics.links.length);
    console.log("[CLAVE] Links:", JSON.stringify(pageDiagnostics.links, null, 2));
    console.log("[CLAVE] Number of forms:", pageDiagnostics.forms.length);
    console.log("[CLAVE] Forms:", JSON.stringify(pageDiagnostics.forms, null, 2));
    console.log("[CLAVE] Number of input elements:", pageDiagnostics.inputs.length);
    console.log("[CLAVE] Inputs:", JSON.stringify(pageDiagnostics.inputs, null, 2));
    console.log("[CLAVE] Number of iframes:", pageDiagnostics.iframes.length);
    console.log("[CLAVE] Iframes:", JSON.stringify(pageDiagnostics.iframes, null, 2));
    console.log("[CLAVE] Visible elements with keywords:", JSON.stringify(pageDiagnostics.visibleElements, null, 2));

    const relevantHrefs = pageDiagnostics.links.map(l => l.href).filter(h => h && h.length > 0);
    const relevantActions = pageDiagnostics.forms.map(f => f.action).filter(a => a && a.length > 0);
    console.log("[CLAVE] RELEVANT HREFS:", relevantHrefs);
    console.log("[CLAVE] RELEVANT FORM ACTIONS:", relevantActions);
    console.log("[CLAVE] ========================================");

    // Take diagnostic screenshot FIRST
    console.log("[CLAVE] Taking diagnostic screenshot...");
    const diagnosticScreenshot = await newPage.screenshot({
      timeout: 30000,
      type: "jpeg",
      quality: 70,
      fullPage: true
    });
    await bot.sendPhoto(chatId, diagnosticScreenshot, {
      caption: `📊 Page After Certificate Load\n\nURL: ${urlAfterLoad}\nTitle: ${pageDiagnostics.title}\nButtons: ${pageDiagnostics.buttons.length}\nLinks: ${pageDiagnostics.links.length}`,
    });

    // === INTELLIGENT PAGE STATE DETECTION ===
    console.log("[CLAVE] Analyzing page state...");

    const isAppointmentPage =
      urlAfterLoad.includes('solicitar') ||
      urlAfterLoad.includes('tramite') ||
      urlAfterLoad.includes('cita') ||
      pageDiagnostics.bodyText.toLowerCase().includes('solicitar cita') ||
      pageDiagnostics.bodyText.toLowerCase().includes('selecciona provincia');

    const isErrorPage =
      pageDiagnostics.bodyText.toLowerCase().includes('error') ||
      pageDiagnostics.bodyText.toLowerCase().includes('no autorizado') ||
      pageDiagnostics.bodyText.toLowerCase().includes('acceso denegado');

    const isICPPage = urlAfterLoad.includes('icp.administracionelectronica.gob.es');

    // Check for automatic redirect
    const hasMetaRefresh = await newPage.evaluate(() => {
      const meta = document.querySelector('meta[http-equiv="refresh"]');
      return meta ? meta.getAttribute('content') : null;
    }).catch(() => null);

    console.log("[CLAVE] Page State:");
    console.log("[CLAVE]   - Is Appointment Page:", isAppointmentPage);
    console.log("[CLAVE]   - Is Error Page:", isErrorPage);
    console.log("[CLAVE]   - Is ICP Page:", isICPPage);
    console.log("[CLAVE]   - Has Meta Refresh:", hasMetaRefresh);

    // Handle different page states
    if (isErrorPage) {
      console.log("[CLAVE] ERROR: Authentication failed - error page detected");
      await bot.sendMessage(chatId, `❌ Cl@ve authentication failed\n\nURL: ${urlAfterLoad}\nReason: Error page detected - certificate may have been rejected`);
      await newContext.close().catch(() => {});
      return;
    }

    if (isAppointmentPage) {
      console.log("[CLAVE] ✅ Already on appointment page - authentication successful!");
      await bot.sendMessage(chatId, "✅ Cl@ve certificate authentication successful!");
      // Continue to scraping below
    } else if (hasMetaRefresh) {
      console.log("[CLAVE] Detected meta refresh, waiting for automatic redirect...");
      await bot.sendMessage(chatId, "⏳ Page is redirecting...");
      await newPage.waitForTimeout(5000);
      const urlAfterRedirect = newPage.url();
      console.log("[CLAVE] Navigation: FROM:", urlAfterLoad, "TO:", urlAfterRedirect);
    } else if (isICPPage) {
      console.log("[CLAVE] On ICP page - waiting for automatic certificate authentication...");
      await bot.sendMessage(chatId, "⏳ Waiting for certificate authentication...");
      await newPage.waitForTimeout(5000);

      const urlAfterWait = newPage.url();
      console.log("[CLAVE] Navigation after wait: FROM:", urlAfterLoad, "TO:", urlAfterWait);

      if (urlAfterWait !== urlAfterLoad) {
        console.log("[CLAVE] Page navigated - certificate authentication may have occurred");
      } else if (pageDiagnostics.buttons.length > 0 || pageDiagnostics.forms.length > 0) {
        console.log("[CLAVE] No automatic navigation - attempting to interact with page elements");

        // Try clicking first button or submitting form
        if (pageDiagnostics.buttons.length > 0) {
          const btn = pageDiagnostics.buttons[0];
          console.log("[CLAVE] Clicking button:", btn.text);
          await bot.sendMessage(chatId, `🖱️ Clicking: ${btn.text}`);

          try {
            if (btn.id) {
              await newPage.click(`#${btn.id}`);
            } else {
              await newPage.evaluate((btnText) => {
                const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
                const target = buttons.find(b => b.textContent?.includes(btnText) || (b as HTMLInputElement).value?.includes(btnText));
                if (target) (target as HTMLElement).click();
              }, btn.text);
            }
            await newPage.waitForTimeout(3000);
            console.log("[CLAVE] Navigation after button click: FROM:", urlAfterWait, "TO:", newPage.url());
          } catch (e: any) {
            console.log("[CLAVE] Button click failed:", e.message);
          }
        } else if (pageDiagnostics.forms.length > 0) {
          console.log("[CLAVE] Submitting form");
          await bot.sendMessage(chatId, "📝 Submitting authentication form...");
          try {
            await newPage.evaluate(() => {
              const form = document.querySelector('form');
              if (form) form.submit();
            });
            await newPage.waitForTimeout(3000);
            console.log("[CLAVE] Navigation after form submit: FROM:", urlAfterWait, "TO:", newPage.url());
          } catch (e: any) {
            console.log("[CLAVE] Form submit failed:", e.message);
          }
        }
      }
    } else {
      console.log("[CLAVE] ⚠️ Unknown page state");
      await bot.sendMessage(chatId, `⚠️ Unexpected page after certificate loading\n\nURL: ${urlAfterLoad}`);
    }

    // Final URL check
    const urlAfterAuth = newPage.url();
    console.log("[CLAVE] FINAL URL:", urlAfterAuth);
    const finalTitle = await newPage.title().catch(() => '');
    console.log("[CLAVE] Final title:", finalTitle);

    // Check authentication state
    const pageText = await newPage.evaluate(() => {
      if (!document.body) return '';
      return document.body.innerText.toLowerCase();
    }).catch(() => '');

    const authSuccess =
      urlAfterAuth.includes('solicitar') ||
      urlAfterAuth.includes('tramite') ||
      urlAfterAuth.includes('cita') ||
      pageText.includes('solicitar') ||
      pageText.includes('tramite');

    console.log("[CLAVE] Authentication state:", authSuccess ? "SUCCESS" : "UNCERTAIN");
    console.log("[CLAVE] Page text sample:", pageText.substring(0, 200));

    if (authSuccess) {
      console.log("[CLAVE] ✅ Authentication successful!");
      await bot.sendMessage(chatId, "✅ Cl@ve certificate authentication successful! Continuing...");
    } else {
      console.log("[CLAVE] ⚠️ Authentication completed but state uncertain");
      await bot.sendMessage(chatId, `⚠️ Authentication completed\n\nCurrent URL: ${urlAfterAuth}`);
    }

    // Scrape buttons on authenticated page
    console.log("[CLAVE] Scraping authenticated page for available actions...");
    await bot.sendMessage(chatId, "🔍 Scanning for next actions...");

    console.log("[CLAVE] Scrolling to bottom of page...");
    await newPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await newPage.waitForTimeout(1000);

    console.log("[CLAVE] Extracting dynamic buttons from authenticated page...");
    const dynamicButtons = await newPage.evaluate(() => {
      const foundBtns = [];
      const buttonTargets = [
        { id: 'btnEntrar', label: 'Entrar (Sin Cl@ve)', selectors: ['#btnEntrar', 'input[value="Entrar"]'] },
        { id: 'btnAceptar', label: 'Aceptar', selectors: ['#btnAceptar', 'input[value="Aceptar"]'] },
        { id: 'btnSiguiente', label: 'Siguiente / Continuar', selectors: ['#btnSiguiente', 'input[value="Siguiente"]', 'input[value="Continuar"]'] }
      ];

      let idx = 0;
      for (const target of buttonTargets) {
        for (const sel of target.selectors) {
          const elements = document.querySelectorAll(sel);
          for (const el of Array.from(elements)) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              let finalSelector = sel;
              if (el.id) {
                finalSelector = '#' + el.id;
              } else {
                el.setAttribute('data-bot-id', 'fastbtn-' + idx);
                finalSelector = '[data-bot-id="fastbtn-' + idx + '"]';
              }
              foundBtns.push({ text: target.label, selector: finalSelector, index: idx });
              idx++;
              break;
            }
          }
          if (foundBtns.some(b => b.text === target.label)) break;
        }
      }
      return foundBtns;
    });

    console.log(`[CLAVE] Found ${dynamicButtons.length} buttons on authenticated page:`, dynamicButtons.map(b => b.text));

    console.log("[CLAVE] Setting up session timeout...");
    const timeoutId = setTimeout(async () => {
      console.log("[CLAVE] Session timeout reached");
      await bot.sendMessage(chatId, "⏳ Session expired due to inactivity.");
      cleanupSession(chatId);
    }, 10 * 60 * 1000);

    console.log("[CLAVE] Updating active session with new authenticated context...");
    activeSessions.set(chatId, {
      ...session,
      context: newContext,
      page: newPage,
      timeoutId,
      dynamicButtons: dynamicButtons || [],
    });

    console.log("[CLAVE] Persisting session state...");
    await persistSessionState(chatId);

    console.log("[CLAVE] Taking screenshot of authenticated page...");
    const screenshot = await newPage.screenshot({
      timeout: 30000,
      animations: "disabled",
      type: "jpeg",
      quality: 40,
    });

    console.log("[CLAVE] Building inline keyboard with available actions...");
    const inline_keyboard = [];
    if (dynamicButtons && dynamicButtons.length > 0) {
      dynamicButtons.forEach(btn => {
        inline_keyboard.push([{ text: "🖱️ " + btn.text, callback_data: "dyn_" + btn.index }]);
      });
    }
    inline_keyboard.push([{ text: "📝 Autofill Form (NIE/Name) [Fallback]", callback_data: "autofill_form" }]);

    console.log("[CLAVE] Sending authenticated page screenshot to user...");
    await bot.sendPhoto(chatId, screenshot, {
      caption: "✅ Cl@ve authentication completed!\n\nHere is the authenticated page. Choose your next action:",
      reply_markup: { inline_keyboard },
    });

    console.log("[CLAVE] Closing old browser context...");
    await context.close().catch(() => {});

    console.log("[CLAVE] === Authentication Flow Completed Successfully ===");
  } catch (err: any) {
    console.error("[CLAVE] ERROR during authentication:", err);
    console.error("[CLAVE] Error stack:", err.stack);
    await bot.sendMessage(chatId, `❌ Error during Cl@ve authentication: ${err.message}`);
  }
}
