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

// Enhanced page state detection
enum ClavePageState {
  CLAVE_METHOD_SELECTION = "CLAVE_METHOD_SELECTION",
  CERTIFICATE_AUTHENTICATING = "CERTIFICATE_AUTHENTICATING",
  AUTHENTICATED = "AUTHENTICATED",
  ERROR = "ERROR",
  UNKNOWN = "UNKNOWN"
}

interface PageAnalysis {
  state: ClavePageState;
  url: string;
  title: string;
  errorText?: string;
  bodyText: string;
  hasErrorIndicators: boolean;
  hasAuthenticatedIndicators: boolean;
}

async function analyzePage(page: any): Promise<PageAnalysis> {
  const url = page.url();
  const title = await page.title().catch(() => '');

  const pageData = await page.evaluate(() => {
    const bodyText = document.body ? document.body.innerText : '';
    const bodyTextLower = bodyText.toLowerCase();

    // Check for error indicators
    const errorKeywords = [
      'se ha producido un error',
      'error',
      'no autorizado',
      'acceso denegado',
      'no se ha podido',
      'autenticación fallida',
      'authentication failed',
      'por favor, inténtelo de nuevo',
      'servicio no disponible',
      'access denied'
    ];

    const hasErrorIndicators = errorKeywords.some(keyword => bodyTextLower.includes(keyword));

    // Check for authenticated/success indicators
    const authenticatedKeywords = [
      'solicitar cita',
      'datos personales',
      'seleccione la fecha',
      'confirmar cita',
      'formulario',
      'nie',
      'passport',
      'nombre completo'
    ];

    const hasAuthenticatedIndicators = authenticatedKeywords.some(keyword => bodyTextLower.includes(keyword));

    // Extract visible error text if present
    let errorText = '';
    const errorElements = document.querySelectorAll('[class*="error"], [id*="error"], .alert-danger, .error-message');
    if (errorElements.length > 0) {
      errorText = Array.from(errorElements)
        .map(el => el.textContent?.trim())
        .filter(t => t && t.length > 0)
        .join(' | ');
    }

    // If no explicit error element, extract text around "error" keyword
    if (!errorText && hasErrorIndicators) {
      const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const errorLines = lines.filter(line =>
        line.toLowerCase().includes('error') ||
        line.toLowerCase().includes('no se ha podido')
      );
      errorText = errorLines.slice(0, 3).join(' ');
    }

    return {
      bodyText: bodyText.substring(0, 1000),
      hasErrorIndicators,
      hasAuthenticatedIndicators,
      errorText
    };
  }).catch(() => ({
    bodyText: '',
    hasErrorIndicators: false,
    hasAuthenticatedIndicators: false,
    errorText: ''
  }));

  // Determine state based on URL and page content
  let state = ClavePageState.UNKNOWN;

  // Check for error state FIRST (highest priority)
  if (pageData.hasErrorIndicators || pageData.errorText) {
    state = ClavePageState.ERROR;
  }
  // Check for authenticated state
  else if (
    pageData.hasAuthenticatedIndicators ||
    url.includes('solicitar') ||
    url.includes('tramite') ||
    url.includes('cita') ||
    url.includes('/form') ||
    url.includes('/datos')
  ) {
    state = ClavePageState.AUTHENTICATED;
  }
  // ICP authentication page
  else if (url.includes('icp.administracionelectronica.gob.es')) {
    state = ClavePageState.CERTIFICATE_AUTHENTICATING;
  }
  // Cl@ve method selection page
  else if (
    url.includes('clave.gob.es') ||
    url.includes('valide.redsara.es') ||
    pageData.bodyText.toLowerCase().includes('seleccione el método')
  ) {
    state = ClavePageState.CLAVE_METHOD_SELECTION;
  }

  return {
    state,
    url,
    title,
    errorText: pageData.errorText,
    bodyText: pageData.bodyText,
    hasErrorIndicators: pageData.hasErrorIndicators,
    hasAuthenticatedIndicators: pageData.hasAuthenticatedIndicators
  };
}

export async function handleClaveClickWithCert(chatId: number, buttonSelector: string) {
  console.log("[CLAVE] === Starting Cl@ve Authentication Flow ===");
  console.log(`[CLAVE] ChatId: ${chatId}`);

  // Load certificate
  const cert = (() => {
    const p12 = getP12Path(chatId);
    const pw = getPassword(chatId);
    if (!p12 || !pw) {
      console.log("[CLAVE] ERROR: Certificate or password not found");
      return null;
    }

    // Validate certificate file
    try {
      if (!fs.existsSync(p12)) {
        console.log(`[CLAVE] ERROR: Certificate file does not exist: ${p12}`);
        return null;
      }
      const stats = fs.statSync(p12);
      console.log(`[CLAVE] Certificate file: ${p12}`);
      console.log(`[CLAVE] Certificate file size: ${stats.size} bytes`);
      console.log(`[CLAVE] Certificate file exists: true`);
      console.log(`[CLAVE] Certificate loaded: true`);

      if (stats.size === 0) {
        console.log("[CLAVE] ERROR: Certificate file is empty");
        return null;
      }
      // Verify readable
      fs.readFileSync(p12);
      console.log("[CLAVE] Certificate validated and readable");
    } catch (err: any) {
      console.log(`[CLAVE] ERROR: Cannot read certificate file: ${err.message}`);
      return null;
    }

    return { p12Path: p12, password: pw };
  })();

  if (!cert) {
    await bot.sendMessage(chatId, "⚠️ Certificate or password missing. Please upload them first.");
    return;
  }

  const session = activeSessions.get(chatId);
  if (!session) {
    console.log("[CLAVE] ERROR: No active session found");
    await bot.sendMessage(chatId, "⚠️ Session expired. Please launch the browser again.");
    return;
  }

  const { browser, context, page } = session;
  const originalPageUrl = page.url();

  console.log("[CLAVE] ========================================");
  console.log("[CLAVE] ORIGINAL SESSION STATE");
  console.log("[CLAVE] Current browser URL:", originalPageUrl);
  console.log("[CLAVE] ========================================");

  await bot.sendMessage(chatId, "🔐 Preparing certificate authentication...\n\n⚠️ Preserving your session...");

  try {
    // CRITICAL: Save session storage state BEFORE creating new context
    console.log("[CLAVE] Saving original session state...");
    const sessionState = await context.storageState().catch(() => null);

    if (sessionState) {
      console.log("[CLAVE] Session state captured:");
      console.log(`[CLAVE] - Cookies: ${sessionState.cookies?.length || 0}`);
      console.log(`[CLAVE] - Origins: ${sessionState.origins?.length || 0}`);
    } else {
      console.log("[CLAVE] WARNING: Could not capture session state");
    }

    chromium.use(stealthPlugin());

    // Create unique proxy session
    const sessionStr = crypto.randomBytes(8).toString("hex");
    const randomPassword = `${PROXY_CONFIG.password}_session-${sessionStr}`;

    // Configure certificate for ALL possible Spanish government domains
    const certOrigins = [
      "https://sede.administracionespublicas.gob.es",
      "https://www.sede.administracionespublicas.gob.es",
      "https://clave.gob.es",
      "https://www.clave.gob.es",
      "https://valide.redsara.es",
      "https://www.valide.redsara.es",
      "https://icp.administracionelectronica.gob.es",
      "https://www.icp.administracionelectronica.gob.es",
      "https://sede.administracion.gob.es",
      "https://www.sede.administracion.gob.es",
    ];

    console.log("[CLAVE] Certificate origins configured:");
    certOrigins.forEach(origin => console.log(`[CLAVE]   - ${origin}`));

    // Create new context with certificates AND preserved session
    const contextOptions: any = {
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
    };

    // CRITICAL: Restore session state if available
    if (sessionState) {
      contextOptions.storageState = sessionState;
      console.log("[CLAVE] Session state will be restored in new context");
    }

    const newContext = await browser.newContext(contextOptions);
    const newPage = await newContext.newPage();

    // Track navigations
    let navigationChain: string[] = [];
    newPage.on('framenavigated', (frame) => {
      if (frame === newPage.mainFrame()) {
        const navUrl = frame.url();
        navigationChain.push(navUrl);
        console.log(`[CLAVE] Navigation detected: ${navUrl}`);
      }
    });

    console.log("[CLAVE] ========================================");
    console.log("[CLAVE] Navigating to Cl@ve page with certificate...");
    console.log(`[CLAVE] Target URL: ${originalPageUrl}`);
    console.log("[CLAVE] ========================================");

    await bot.sendMessage(chatId, "🌐 Loading Cl@ve authentication page with your certificate...");

    await newPage.goto(originalPageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    console.log(`[CLAVE] Initial page loaded: ${newPage.url()}`);
    await newPage.waitForTimeout(3000);

    // Analyze initial page state
    let analysis = await analyzePage(newPage);
    console.log("[CLAVE] ========================================");
    console.log("[CLAVE] INITIAL PAGE ANALYSIS");
    console.log(`[CLAVE] State: ${analysis.state}`);
    console.log(`[CLAVE] URL: ${analysis.url}`);
    console.log(`[CLAVE] Title: ${analysis.title}`);
    console.log(`[CLAVE] Has Error Indicators: ${analysis.hasErrorIndicators}`);
    console.log(`[CLAVE] Has Authenticated Indicators: ${analysis.hasAuthenticatedIndicators}`);
    if (analysis.errorText) {
      console.log(`[CLAVE] Error Text: ${analysis.errorText}`);
    }
    console.log("[CLAVE] Body Text Preview:", analysis.bodyText.substring(0, 300));
    console.log("[CLAVE] ========================================");

    // Take diagnostic screenshot
    const diagnosticScreenshot = await newPage.screenshot({
      timeout: 30000,
      type: "jpeg",
      quality: 70,
      fullPage: true
    });
    await bot.sendPhoto(chatId, diagnosticScreenshot, {
      caption: `📊 Page State: ${analysis.state}\n\nURL: ${analysis.url}\nTitle: ${analysis.title}`,
    });

    // Handle different states
    if (analysis.state === ClavePageState.ERROR) {
      console.log("[CLAVE] ===== GOVERNMENT ERROR DETECTED =====");
      console.log(`[CLAVE] URL: ${analysis.url}`);
      console.log(`[CLAVE] Title: ${analysis.title}`);
      console.log(`[CLAVE] Error text: ${analysis.errorText}`);
      console.log(`[CLAVE] Body preview: ${analysis.bodyText.substring(0, 500)}`);
      console.log(`[CLAVE] Navigation chain: ${navigationChain.join(' → ')}`);
      console.log("[CLAVE] ========================================");

      await bot.sendMessage(
        chatId,
        `❌ Cl@ve authentication failed!\n\n` +
        `The government service returned an error.\n\n` +
        `Error: ${analysis.errorText || 'Unknown error - see screenshot'}\n\n` +
        `URL: ${analysis.url}\n\n` +
        `Possible causes:\n` +
        `- Certificate not accepted by the server\n` +
        `- Session/cookies lost during context switch\n` +
        `- Certificate not configured for the correct domain\n` +
        `- Authentication token/session expired`
      );

      await newContext.close().catch(() => {});
      return;
    }

    if (analysis.state === ClavePageState.CERTIFICATE_AUTHENTICATING) {
      console.log("[CLAVE] On ICP authentication page, waiting for certificate exchange...");
      await bot.sendMessage(chatId, "⏳ Authenticating with certificate...");

      // Wait for automatic authentication
      await newPage.waitForTimeout(5000);

      // Re-analyze
      analysis = await analyzePage(newPage);
      console.log(`[CLAVE] After wait, state: ${analysis.state}, URL: ${analysis.url}`);

      // If still on ICP page, try clicking any visible buttons
      if (analysis.state === ClavePageState.CERTIFICATE_AUTHENTICATING) {
        const buttons = await newPage.$$('button, input[type="submit"], input[type="button"]');
        if (buttons.length > 0) {
          console.log(`[CLAVE] Found ${buttons.length} buttons, clicking first visible one`);
          await buttons[0].click().catch(() => {});
          await newPage.waitForTimeout(3000);
          analysis = await analyzePage(newPage);
        }
      }
    }

    // Final state check
    console.log("[CLAVE] ========================================");
    console.log("[CLAVE] FINAL PAGE ANALYSIS");
    console.log(`[CLAVE] Final State: ${analysis.state}`);
    console.log(`[CLAVE] Final URL: ${analysis.url}`);
    console.log(`[CLAVE] Final Title: ${analysis.title}`);
    console.log(`[CLAVE] Navigation chain: ${navigationChain.join(' → ')}`);
    console.log("[CLAVE] ========================================");

    // Check final state
    if (analysis.state === ClavePageState.ERROR) {
      console.log("[CLAVE] ERROR: Final page is an error page");
      await bot.sendMessage(
        chatId,
        `❌ Cl@ve authentication failed!\n\n` +
        `Error: ${analysis.errorText || 'Government service error'}\n\n` +
        `URL: ${analysis.url}`
      );
      await newContext.close().catch(() => {});
      return;
    }

    if (analysis.state !== ClavePageState.AUTHENTICATED) {
      console.log("[CLAVE] WARNING: Authentication state uncertain");
      await bot.sendMessage(
        chatId,
        `⚠️ Authentication completed but state is uncertain\n\n` +
        `Current State: ${analysis.state}\n` +
        `URL: ${analysis.url}\n\n` +
        `Please check the screenshot to verify.`
      );
    } else {
      console.log("[CLAVE] ✅ Authentication successful!");
      await bot.sendMessage(chatId, "✅ Cl@ve authentication successful!");
    }

    // Scrape authenticated page
    console.log("[CLAVE] Scraping authenticated page for available actions...");
    await newPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await newPage.waitForTimeout(1000);

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

    console.log(`[CLAVE] Found ${dynamicButtons.length} buttons:`, dynamicButtons.map(b => b.text));

    // Update session
    const timeoutId = setTimeout(async () => {
      console.log("[CLAVE] Session timeout");
      await bot.sendMessage(chatId, "⏳ Session expired due to inactivity.");
      cleanupSession(chatId);
    }, 10 * 60 * 1000);

    activeSessions.set(chatId, {
      ...session,
      context: newContext,
      page: newPage,
      timeoutId,
      dynamicButtons: dynamicButtons || [],
    });

    await persistSessionState(chatId);

    // Final screenshot
    const screenshot = await newPage.screenshot({
      timeout: 30000,
      animations: "disabled",
      type: "jpeg",
      quality: 40,
    });

    const inline_keyboard = [];
    if (dynamicButtons && dynamicButtons.length > 0) {
      dynamicButtons.forEach(btn => {
        inline_keyboard.push([{ text: "🖱️ " + btn.text, callback_data: "dyn_" + btn.index }]);
      });
    }
    inline_keyboard.push([{ text: "📝 Autofill Form (NIE/Name) [Fallback]", callback_data: "autofill_form" }]);

    await bot.sendPhoto(chatId, screenshot, {
      caption: analysis.state === ClavePageState.AUTHENTICATED
        ? "✅ Cl@ve authentication completed!\n\nHere is the authenticated page. Choose your next action:"
        : "⚠️ Authentication process completed. Please verify the page state:",
      reply_markup: { inline_keyboard },
    });

    // Close old context
    console.log("[CLAVE] Closing old browser context...");
    await context.close().catch(() => {});

    console.log("[CLAVE] === Authentication Flow Completed ===");
  } catch (err: any) {
    console.error("[CLAVE] ERROR during authentication:", err);
    console.error("[CLAVE] Error stack:", err.stack);
    await bot.sendMessage(chatId, `❌ Error during Cl@ve authentication:\n\n${err.message}`);

    // Log fetch failed errors specifically
    if (err.message?.includes('fetch failed')) {
      console.error("[CLAVE] FETCH FAILED - Possible network/proxy issue");
      await bot.sendMessage(chatId, "⚠️ Network error detected. This may be a proxy or connection issue.");
    }
  }
}
