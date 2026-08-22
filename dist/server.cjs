var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/botContext.ts
var botContext_exports = {};
__export(botContext_exports, {
  PROXY_CONFIG: () => PROXY_CONFIG,
  activeSessions: () => activeSessions,
  bot: () => bot,
  cleanupSession: () => cleanupSession,
  initBotContext: () => initBotContext,
  persistSessionState: () => persistSessionState,
  userStates: () => userStates
});
function initBotContext(b, aS, uS, cS, pS, pC) {
  bot = b;
  activeSessions = aS;
  userStates = uS;
  cleanupSession = cS;
  persistSessionState = pS;
  PROXY_CONFIG = pC;
}
var bot, activeSessions, userStates, cleanupSession, persistSessionState, PROXY_CONFIG;
var init_botContext = __esm({
  "src/botContext.ts"() {
  }
});

// src/queue.ts
var queue_exports = {};
__export(queue_exports, {
  QueueManager: () => QueueManager,
  browserQueue: () => browserQueue
});
var QueueManager, browserQueue;
var init_queue = __esm({
  "src/queue.ts"() {
    QueueManager = class {
      queue = [];
      activeCount = 0;
      concurrencyLimit;
      constructor(concurrencyLimit = 3) {
        this.concurrencyLimit = concurrencyLimit;
      }
      enqueue(task, onWait) {
        return new Promise((resolve, reject) => {
          const wrappedTask = async () => {
            try {
              const timeoutPromise = new Promise((_, rejectTimeout) => {
                setTimeout(() => rejectTimeout(new Error("Queue task timed out after 3 minutes")), 18e4);
              });
              await Promise.race([task(), timeoutPromise]);
              resolve();
            } catch (error) {
              console.error("Queue Task Error/Timeout:", error);
              reject(error);
            } finally {
              this.activeCount--;
              this.processQueue();
            }
          };
          this.queue.push(wrappedTask);
          if (this.activeCount < this.concurrencyLimit) {
            this.processQueue();
          } else {
            if (onWait) {
              onWait(this.queue.length);
            }
          }
        });
      }
      processQueue() {
        if (this.activeCount < this.concurrencyLimit && this.queue.length > 0) {
          const nextTask = this.queue.shift();
          if (nextTask) {
            this.activeCount++;
            nextTask();
          }
        }
      }
    };
    browserQueue = new QueueManager(1);
  }
});

// src/clave/certManager.ts
function claveDir(chatId) {
  const dir = import_path5.default.join(CLIENTS_DIR, String(chatId), "clave");
  if (!import_fs5.default.existsSync(dir)) {
    import_fs5.default.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
function hasSavedCert(chatId) {
  const certPath = import_path5.default.join(claveDir(chatId), "certificate.p12");
  return import_fs5.default.existsSync(certPath);
}
function hasSavedPassword(chatId) {
  const pwFile = import_path5.default.join(claveDir(chatId), "encrypted_password");
  return import_fs5.default.existsSync(pwFile);
}
function getP12Path(chatId) {
  const certPath = import_path5.default.join(claveDir(chatId), "certificate.p12");
  if (!import_fs5.default.existsSync(certPath)) return null;
  return certPath;
}
function saveP12(chatId, buffer, filename) {
  const dir = claveDir(chatId);
  const dest = import_path5.default.join(dir, "certificate.p12");
  import_fs5.default.writeFileSync(dest, buffer);
  console.log(`[CertManager] Saved ORIGINAL certificate for chat ${chatId}: ${dest}`);
  return dest;
}
function savePassword(chatId, password) {
  const dir = claveDir(chatId);
  const iv = import_crypto2.default.randomBytes(16);
  const cipher = import_crypto2.default.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "utf8"), iv);
  let encrypted = cipher.update(password, "utf8", "hex");
  encrypted += cipher.final("hex");
  const payload = iv.toString("hex") + ":" + encrypted;
  const pwFile = import_path5.default.join(dir, "encrypted_password");
  import_fs5.default.writeFileSync(pwFile, payload, "utf8");
  console.log(`[CertManager] Saved encrypted password for chat ${chatId}`);
}
function getPassword(chatId) {
  const pwFile = import_path5.default.join(claveDir(chatId), "encrypted_password");
  if (!import_fs5.default.existsSync(pwFile)) return null;
  try {
    const raw = import_fs5.default.readFileSync(pwFile, "utf8").trim();
    const [ivHex, encrypted] = raw.split(":");
    if (!ivHex || !encrypted) {
      console.error(`[CertManager] Invalid password file format for chat ${chatId}`);
      import_fs5.default.unlinkSync(pwFile);
      return null;
    }
    const iv = Buffer.from(ivHex, "hex");
    const decipher = import_crypto2.default.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "utf8"), iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error(`[CertManager] Failed to decrypt password for chat ${chatId}:`, error.message);
    try {
      import_fs5.default.unlinkSync(pwFile);
      console.log(`[CertManager] Deleted corrupted password file for chat ${chatId}`);
    } catch (e) {
      console.error(`[CertManager] Failed to delete corrupted password file:`, e);
    }
    return null;
  }
}
var import_fs5, import_path5, import_crypto2, CLIENTS_DIR, ALGORITHM, ENCRYPTION_KEY;
var init_certManager = __esm({
  "src/clave/certManager.ts"() {
    import_fs5 = __toESM(require("fs"), 1);
    import_path5 = __toESM(require("path"), 1);
    import_crypto2 = __toESM(require("crypto"), 1);
    CLIENTS_DIR = import_path5.default.resolve("./clients");
    ALGORITHM = "aes-256-cbc";
    ENCRYPTION_KEY = process.env.CERT_ENCRYPTION_KEY || import_crypto2.default.randomBytes(32).toString("hex").slice(0, 32);
  }
});

// src/clave/handleClaveAuth.ts
function isClaveButton(text) {
  const lower = text.toLowerCase();
  if (lower.includes("sin cl@ve") || lower.includes("sin clave")) {
    return false;
  }
  const hasClave = lower.includes("clave") || lower.includes("cl@ve");
  const isAuthOption = lower.includes("acceder") || lower.includes("con cl") || lower.includes("con clave");
  return hasClave && (isAuthOption || lower.includes("acceder"));
}
async function handleClaveAuthCheck(chatId, queryId, callbackAfterReady) {
  if (!hasSavedCert(chatId)) {
    claveAuthStates.set(chatId, { step: "awaiting_p12" });
    await bot.sendMessage(
      chatId,
      "\u{1F510} No Cl@ve certificate found for your account.\n\nPlease upload your `.p12` certificate file now.\nYou can send it as a document in this chat.",
      { parse_mode: "Markdown" }
    );
    if (queryId) await bot.answerCallbackQuery(queryId);
    return true;
  }
  if (!hasSavedPassword(chatId)) {
    claveAuthStates.set(chatId, { step: "awaiting_password" });
    await bot.sendMessage(
      chatId,
      "\u{1F510} Certificate found. Now please reply with your Cl@ve certificate **password**:",
      { parse_mode: "Markdown" }
    );
    if (queryId) await bot.answerCallbackQuery(queryId);
    return true;
  }
  await callbackAfterReady();
  return false;
}
async function handleClaveDocument(chatId, fileName, fileBuffer) {
  const state = claveAuthStates.get(chatId);
  if (!state || state.step !== "awaiting_p12") return false;
  if (!fileName.toLowerCase().endsWith(".p12")) {
    await bot.sendMessage(
      chatId,
      "\u26A0\uFE0F That doesn't look like a `.p12` file. Please upload a valid `.p12` certificate.",
      { parse_mode: "Markdown" }
    );
    return true;
  }
  saveP12(chatId, fileBuffer, fileName);
  state.step = "awaiting_password";
  state.p12Filename = fileName;
  await bot.sendMessage(
    chatId,
    `\u2705 Certificate **${fileName}** saved!

Now please reply with your Cl@ve certificate **password**:`,
    { parse_mode: "Markdown" }
  );
  return true;
}
async function handleClavePasswordText(chatId, text) {
  const state = claveAuthStates.get(chatId);
  if (!state || state.step !== "awaiting_password") return false;
  savePassword(chatId, text.trim());
  claveAuthStates.delete(chatId);
  await bot.sendMessage(
    chatId,
    "\u2705 Cl@ve password saved and encrypted!\n\n\u{1F680} Ready to authenticate with Cl@ve. Click **'Acceder con Cl@ve'** again to proceed.",
    { parse_mode: "Markdown" }
  );
  return true;
}
async function analyzePage(page) {
  const url = page.url();
  const title = await page.title().catch(() => "");
  const pageData = await page.evaluate(() => {
    const bodyText = document.body ? document.body.innerText : "";
    const bodyTextLower = bodyText.toLowerCase();
    const errorKeywords = [
      "se ha producido un error",
      "error",
      "no autorizado",
      "acceso denegado",
      "no se ha podido",
      "autenticaci\xF3n fallida",
      "authentication failed",
      "por favor, int\xE9ntelo de nuevo",
      "servicio no disponible",
      "access denied"
    ];
    const hasErrorIndicators = errorKeywords.some((keyword) => bodyTextLower.includes(keyword));
    const authenticatedKeywords = [
      "solicitar cita",
      "datos personales",
      "seleccione la fecha",
      "confirmar cita",
      "formulario",
      "nie",
      "passport",
      "nombre completo"
    ];
    const hasAuthenticatedIndicators = authenticatedKeywords.some((keyword) => bodyTextLower.includes(keyword));
    let errorText = "";
    const errorElements = document.querySelectorAll('[class*="error"], [id*="error"], .alert-danger, .error-message');
    if (errorElements.length > 0) {
      errorText = Array.from(errorElements).map((el) => el.textContent?.trim()).filter((t) => t && t.length > 0).join(" | ");
    }
    if (!errorText && hasErrorIndicators) {
      const lines = bodyText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      const errorLines = lines.filter(
        (line) => line.toLowerCase().includes("error") || line.toLowerCase().includes("no se ha podido")
      );
      errorText = errorLines.slice(0, 3).join(" ");
    }
    return {
      bodyText: bodyText.substring(0, 1e3),
      hasErrorIndicators,
      hasAuthenticatedIndicators,
      errorText
    };
  }).catch(() => ({
    bodyText: "",
    hasErrorIndicators: false,
    hasAuthenticatedIndicators: false,
    errorText: ""
  }));
  let state = "UNKNOWN" /* UNKNOWN */;
  if (pageData.hasErrorIndicators || pageData.errorText) {
    state = "ERROR" /* ERROR */;
  } else if (pageData.hasAuthenticatedIndicators || url.includes("solicitar") || url.includes("tramite") || url.includes("cita") || url.includes("/form") || url.includes("/datos")) {
    state = "AUTHENTICATED" /* AUTHENTICATED */;
  } else if (url.includes("icp.administracionelectronica.gob.es")) {
    state = "CERTIFICATE_AUTHENTICATING" /* CERTIFICATE_AUTHENTICATING */;
  } else if (url.includes("clave.gob.es") || url.includes("valide.redsara.es") || pageData.bodyText.toLowerCase().includes("seleccione el m\xE9todo")) {
    state = "CLAVE_METHOD_SELECTION" /* CLAVE_METHOD_SELECTION */;
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
async function handleClaveClickWithCert(chatId, buttonSelector) {
  console.log("[CLAVE] === Starting Cl@ve Authentication Flow ===");
  console.log(`[CLAVE] ChatId: ${chatId}`);
  const cert = (() => {
    const p12 = getP12Path(chatId);
    const pw = getPassword(chatId);
    if (!p12 || !pw) {
      console.log("[CLAVE] ERROR: Certificate or password not found");
      return null;
    }
    try {
      if (!import_fs6.default.existsSync(p12)) {
        console.log(`[CLAVE] ERROR: Certificate file does not exist: ${p12}`);
        return null;
      }
      const stats = import_fs6.default.statSync(p12);
      console.log(`[CLAVE] Certificate file: ${p12}`);
      console.log(`[CLAVE] Certificate file size: ${stats.size} bytes`);
      console.log(`[CLAVE] Certificate file exists: true`);
      console.log(`[CLAVE] Certificate loaded: true`);
      if (stats.size === 0) {
        console.log("[CLAVE] ERROR: Certificate file is empty");
        return null;
      }
      import_fs6.default.readFileSync(p12);
      console.log("[CLAVE] Certificate validated and readable");
    } catch (err) {
      console.log(`[CLAVE] ERROR: Cannot read certificate file: ${err.message}`);
      return null;
    }
    return { p12Path: p12, password: pw };
  })();
  if (!cert) {
    await bot.sendMessage(chatId, "\u26A0\uFE0F Certificate or password missing. Please upload them first.");
    return;
  }
  const session = activeSessions.get(chatId);
  if (!session) {
    console.log("[CLAVE] ERROR: No active session found");
    await bot.sendMessage(chatId, "\u26A0\uFE0F Session expired. Please launch the browser again.");
    return;
  }
  const { browser, context, page } = session;
  const originalPageUrl = page.url();
  console.log("[CLAVE] ========================================");
  console.log("[CLAVE] ORIGINAL SESSION STATE");
  console.log("[CLAVE] Current browser URL:", originalPageUrl);
  console.log("[CLAVE] ========================================");
  await bot.sendMessage(chatId, "\u{1F510} Preparing certificate authentication...\n\n\u26A0\uFE0F Preserving your session...");
  try {
    console.log("[CLAVE] Saving original session state...");
    const sessionState = await context.storageState().catch(() => null);
    if (sessionState) {
      console.log("[CLAVE] Session state captured:");
      console.log(`[CLAVE] - Cookies: ${sessionState.cookies?.length || 0}`);
      console.log(`[CLAVE] - Origins: ${sessionState.origins?.length || 0}`);
    } else {
      console.log("[CLAVE] WARNING: Could not capture session state");
    }
    import_playwright_extra2.chromium.use((0, import_puppeteer_extra_plugin_stealth2.default)());
    const sessionStr = import_crypto3.default.randomBytes(8).toString("hex");
    const randomPassword = `${PROXY_CONFIG.password}_session-${sessionStr}`;
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
      "https://www.sede.administracion.gob.es"
    ];
    console.log("[CLAVE] Certificate origins configured:");
    certOrigins.forEach((origin) => console.log(`[CLAVE]   - ${origin}`));
    const contextOptions = {
      proxy: {
        server: PROXY_CONFIG.server,
        username: PROXY_CONFIG.username,
        password: randomPassword
      },
      clientCertificates: certOrigins.map((origin) => ({
        origin,
        pfxPath: cert.p12Path,
        passphrase: cert.password
      })),
      ignoreHTTPSErrors: true,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "es-ES",
      timezoneId: "Europe/Madrid"
    };
    if (sessionState) {
      contextOptions.storageState = sessionState;
      console.log("[CLAVE] Session state will be restored in new context");
    }
    const newContext = await browser.newContext(contextOptions);
    const newPage = await newContext.newPage();
    let navigationChain = [];
    newPage.on("framenavigated", (frame) => {
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
    await bot.sendMessage(chatId, "\u{1F310} Loading Cl@ve authentication page with your certificate...");
    await newPage.goto(originalPageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 6e4
    });
    console.log(`[CLAVE] Initial page loaded: ${newPage.url()}`);
    await newPage.waitForTimeout(3e3);
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
    const diagnosticScreenshot = await newPage.screenshot({
      timeout: 3e4,
      type: "jpeg",
      quality: 70,
      fullPage: true
    });
    await bot.sendPhoto(chatId, diagnosticScreenshot, {
      caption: `\u{1F4CA} Page State: ${analysis.state}

URL: ${analysis.url}
Title: ${analysis.title}`
    });
    if (analysis.state === "ERROR" /* ERROR */) {
      console.log("[CLAVE] ===== GOVERNMENT ERROR DETECTED =====");
      console.log(`[CLAVE] URL: ${analysis.url}`);
      console.log(`[CLAVE] Title: ${analysis.title}`);
      console.log(`[CLAVE] Error text: ${analysis.errorText}`);
      console.log(`[CLAVE] Body preview: ${analysis.bodyText.substring(0, 500)}`);
      console.log(`[CLAVE] Navigation chain: ${navigationChain.join(" \u2192 ")}`);
      console.log("[CLAVE] ========================================");
      await bot.sendMessage(
        chatId,
        `\u274C Cl@ve authentication failed!

The government service returned an error.

Error: ${analysis.errorText || "Unknown error - see screenshot"}

URL: ${analysis.url}

Possible causes:
- Certificate not accepted by the server
- Session/cookies lost during context switch
- Certificate not configured for the correct domain
- Authentication token/session expired`
      );
      await newContext.close().catch(() => {
      });
      return;
    }
    if (analysis.state === "CERTIFICATE_AUTHENTICATING" /* CERTIFICATE_AUTHENTICATING */) {
      console.log("[CLAVE] On ICP authentication page, waiting for certificate exchange...");
      await bot.sendMessage(chatId, "\u23F3 Authenticating with certificate...");
      await newPage.waitForTimeout(5e3);
      analysis = await analyzePage(newPage);
      console.log(`[CLAVE] After wait, state: ${analysis.state}, URL: ${analysis.url}`);
      if (analysis.state === "CERTIFICATE_AUTHENTICATING" /* CERTIFICATE_AUTHENTICATING */) {
        const buttons = await newPage.$$('button, input[type="submit"], input[type="button"]');
        if (buttons.length > 0) {
          console.log(`[CLAVE] Found ${buttons.length} buttons, clicking first visible one`);
          await buttons[0].click().catch(() => {
          });
          await newPage.waitForTimeout(3e3);
          analysis = await analyzePage(newPage);
        }
      }
    }
    console.log("[CLAVE] ========================================");
    console.log("[CLAVE] FINAL PAGE ANALYSIS");
    console.log(`[CLAVE] Final State: ${analysis.state}`);
    console.log(`[CLAVE] Final URL: ${analysis.url}`);
    console.log(`[CLAVE] Final Title: ${analysis.title}`);
    console.log(`[CLAVE] Navigation chain: ${navigationChain.join(" \u2192 ")}`);
    console.log("[CLAVE] ========================================");
    if (analysis.state === "ERROR" /* ERROR */) {
      console.log("[CLAVE] ERROR: Final page is an error page");
      await bot.sendMessage(
        chatId,
        `\u274C Cl@ve authentication failed!

Error: ${analysis.errorText || "Government service error"}

URL: ${analysis.url}`
      );
      await newContext.close().catch(() => {
      });
      return;
    }
    if (analysis.state !== "AUTHENTICATED" /* AUTHENTICATED */) {
      console.log("[CLAVE] WARNING: Authentication state uncertain");
      await bot.sendMessage(
        chatId,
        `\u26A0\uFE0F Authentication completed but state is uncertain

Current State: ${analysis.state}
URL: ${analysis.url}

Please check the screenshot to verify.`
      );
    } else {
      console.log("[CLAVE] \u2705 Authentication successful!");
      await bot.sendMessage(chatId, "\u2705 Cl@ve authentication successful!");
    }
    console.log("[CLAVE] Scraping authenticated page for available actions...");
    await newPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await newPage.waitForTimeout(1e3);
    const dynamicButtons = await newPage.evaluate(() => {
      const foundBtns = [];
      const buttonTargets = [
        { id: "btnEntrar", label: "Entrar (Sin Cl@ve)", selectors: ["#btnEntrar", 'input[value="Entrar"]'] },
        { id: "btnAceptar", label: "Aceptar", selectors: ["#btnAceptar", 'input[value="Aceptar"]'] },
        { id: "btnSiguiente", label: "Siguiente / Continuar", selectors: ["#btnSiguiente", 'input[value="Siguiente"]', 'input[value="Continuar"]'] }
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
                finalSelector = "#" + el.id;
              } else {
                el.setAttribute("data-bot-id", "fastbtn-" + idx);
                finalSelector = '[data-bot-id="fastbtn-' + idx + '"]';
              }
              foundBtns.push({ text: target.label, selector: finalSelector, index: idx });
              idx++;
              break;
            }
          }
          if (foundBtns.some((b) => b.text === target.label)) break;
        }
      }
      return foundBtns;
    });
    console.log(`[CLAVE] Found ${dynamicButtons.length} buttons:`, dynamicButtons.map((b) => b.text));
    const timeoutId = setTimeout(async () => {
      console.log("[CLAVE] Session timeout");
      await bot.sendMessage(chatId, "\u23F3 Session expired due to inactivity.");
      cleanupSession(chatId);
    }, 10 * 60 * 1e3);
    activeSessions.set(chatId, {
      ...session,
      context: newContext,
      page: newPage,
      timeoutId,
      dynamicButtons: dynamicButtons || []
    });
    await persistSessionState(chatId);
    const screenshot = await newPage.screenshot({
      timeout: 3e4,
      animations: "disabled",
      type: "jpeg",
      quality: 40
    });
    const inline_keyboard = [];
    if (dynamicButtons && dynamicButtons.length > 0) {
      dynamicButtons.forEach((btn) => {
        inline_keyboard.push([{ text: "\u{1F5B1}\uFE0F " + btn.text, callback_data: "dyn_" + btn.index }]);
      });
    }
    inline_keyboard.push([{ text: "\u{1F4DD} Autofill Form (NIE/Name) [Fallback]", callback_data: "autofill_form" }]);
    await bot.sendPhoto(chatId, screenshot, {
      caption: analysis.state === "AUTHENTICATED" /* AUTHENTICATED */ ? "\u2705 Cl@ve authentication completed!\n\nHere is the authenticated page. Choose your next action:" : "\u26A0\uFE0F Authentication process completed. Please verify the page state:",
      reply_markup: { inline_keyboard }
    });
    console.log("[CLAVE] Closing old browser context...");
    await context.close().catch(() => {
    });
    console.log("[CLAVE] === Authentication Flow Completed ===");
  } catch (err) {
    console.error("[CLAVE] ERROR during authentication:", err);
    console.error("[CLAVE] Error stack:", err.stack);
    await bot.sendMessage(chatId, `\u274C Error during Cl@ve authentication:

${err.message}`);
    if (err.message?.includes("fetch failed")) {
      console.error("[CLAVE] FETCH FAILED - Possible network/proxy issue");
      await bot.sendMessage(chatId, "\u26A0\uFE0F Network error detected. This may be a proxy or connection issue.");
    }
  }
}
var import_crypto3, import_fs6, import_playwright_extra2, import_puppeteer_extra_plugin_stealth2, claveAuthStates;
var init_handleClaveAuth = __esm({
  "src/clave/handleClaveAuth.ts"() {
    init_certManager();
    import_crypto3 = __toESM(require("crypto"), 1);
    import_fs6 = __toESM(require("fs"), 1);
    import_playwright_extra2 = require("playwright-extra");
    import_puppeteer_extra_plugin_stealth2 = __toESM(require("puppeteer-extra-plugin-stealth"), 1);
    init_botContext();
    claveAuthStates = /* @__PURE__ */ new Map();
  }
});

// src/fastmode/db.ts
function loadFastDb() {
  if (import_fs7.default.existsSync(DB_PATH)) {
    const raw = import_fs7.default.readFileSync(DB_PATH, "utf-8");
    try {
      const db2 = JSON.parse(raw);
      if (!db2.profiles) db2.profiles = [];
      return db2;
    } catch (e) {
      return { provinces: [], offices: {}, tramites: {}, profiles: [] };
    }
  }
  return { provinces: [], offices: {}, tramites: {}, profiles: [] };
}
function saveFastDb(db2) {
  if (!db2.profiles) db2.profiles = [];
  import_fs7.default.writeFileSync(DB_PATH, JSON.stringify(db2, null, 2));
}
var import_fs7, import_path6, DB_PATH;
var init_db = __esm({
  "src/fastmode/db.ts"() {
    import_fs7 = __toESM(require("fs"), 1);
    import_path6 = __toESM(require("path"), 1);
    DB_PATH = import_path6.default.resolve("./fastmode_db.json");
  }
});

// src/fastmode/chatState.ts
var chatState_exports = {};
__export(chatState_exports, {
  fastBookingStates: () => fastBookingStates
});
var fastBookingStates;
var init_chatState = __esm({
  "src/fastmode/chatState.ts"() {
    fastBookingStates = /* @__PURE__ */ new Map();
  }
});

// src/automation/dateCalendarMenu.ts
var dateCalendarMenu_exports = {};
__export(dateCalendarMenu_exports, {
  dateRangeState: () => dateRangeState,
  generateCalendarKeyboard: () => generateCalendarKeyboard,
  handleDateCalendarCallback: () => handleDateCalendarCallback,
  sendDateSelectionMenu: () => sendDateSelectionMenu
});
function generateCalendarKeyboard(monthOffset = 0, isSelectingEnd = false) {
  const today = /* @__PURE__ */ new Date();
  const targetMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = monthNames[targetMonth.getMonth()];
  const year = targetMonth.getFullYear();
  const keyboard = [];
  keyboard.push([
    { text: "\u25C0\uFE0F", callback_data: `cal_prev_${monthOffset}` },
    { text: `\u{1F5D3} ${monthName} ${year}`, callback_data: "cal_ignore" },
    { text: "\u25B6\uFE0F", callback_data: `cal_next_${monthOffset}` }
  ]);
  keyboard.push([
    { text: "Mo", callback_data: "cal_ignore" },
    { text: "Tu", callback_data: "cal_ignore" },
    { text: "We", callback_data: "cal_ignore" },
    { text: "Th", callback_data: "cal_ignore" },
    { text: "Fr", callback_data: "cal_ignore" },
    { text: "Sa", callback_data: "cal_ignore" },
    { text: "Su", callback_data: "cal_ignore" }
  ]);
  const daysInMonth = new Date(year, targetMonth.getMonth() + 1, 0).getDate();
  let firstDayOfWeek = targetMonth.getDay();
  firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  let currentWeek = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push({ text: "\xB7", callback_data: "cal_ignore" });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(targetMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    currentWeek.push({ text: `${day}`, callback_data: `cal_day_${dateStr}` });
    if (currentWeek.length === 7) {
      keyboard.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ text: "\xB7", callback_data: "cal_ignore" });
    }
    keyboard.push(currentWeek);
  }
  keyboard.push([
    { text: "\u26A1 3 Days", callback_data: "cal_quick_3days" },
    { text: "\u{1F4C5} 1 Week", callback_data: "cal_quick_1week" },
    { text: "\u{1F31F} Any Date", callback_data: "cal_quick_any" }
  ]);
  return keyboard;
}
function sendDateSelectionMenu(bot3, chatId) {
  dateRangeState.set(chatId, { step: "awaiting_start", monthOffset: 0 });
  bot3.sendMessage(chatId, "\u{1F4C5} *Step 1: Select START Date*\nOr use quick buttons:", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: generateCalendarKeyboard(0, false)
    }
  });
}
async function handleDateCalendarCallback(bot3, chatId, data, queryId, messageId) {
  if (!data.startsWith("cal_")) return false;
  const state = dateRangeState.get(chatId) || { step: "idle", monthOffset: 0 };
  if (data === "cal_ignore") {
    bot3.answerCallbackQuery(queryId);
    return true;
  }
  if (data.startsWith("cal_prev_") || data.startsWith("cal_next_")) {
    const isNext = data.startsWith("cal_next_");
    state.monthOffset += isNext ? 1 : -1;
    bot3.editMessageReplyMarkup({
      inline_keyboard: generateCalendarKeyboard(state.monthOffset, state.step === "awaiting_end")
    }, { chat_id: chatId, message_id: messageId });
    bot3.answerCallbackQuery(queryId);
    return true;
  }
  if (data.startsWith("cal_quick_")) {
    const today = /* @__PURE__ */ new Date();
    state.startDate = /* @__PURE__ */ new Date();
    if (data === "cal_quick_3days") {
      state.endDate = new Date(today.setDate(today.getDate() + 3));
      bot3.sendMessage(chatId, `\u2705 *Range configured:* Next 3 days.
Searching automatically...`, { parse_mode: "Markdown" });
    } else if (data === "cal_quick_1week") {
      state.endDate = new Date(today.setDate(today.getDate() + 7));
      bot3.sendMessage(chatId, `\u2705 *Range configured:* Next week.
Searching automatically...`, { parse_mode: "Markdown" });
    } else if (data === "cal_quick_any") {
      state.endDate = new Date(today.setFullYear(today.getFullYear() + 1));
      bot3.sendMessage(chatId, `\u2705 *Range configured:* Any available date.
Searching automatically...`, { parse_mode: "Markdown" });
    }
    state.step = "completed";
    bot3.deleteMessage(chatId, messageId).catch(() => {
    });
    bot3.answerCallbackQuery(queryId);
    Promise.resolve().then(() => (init_chatState(), chatState_exports)).then((chatStateMod) => {
      if (chatStateMod.fastBookingStates.has(chatId)) {
        Promise.resolve().then(() => (init_fastChatMenu(), fastChatMenu_exports)).then((fastMenu) => {
          fastMenu.showFastModeSummary(bot3, chatId);
        });
      }
    }).catch(() => {
    });
    return true;
  }
  if (data.startsWith("cal_day_")) {
    const dateStr = data.replace("cal_day_", "");
    const selectedDate = new Date(dateStr);
    if (state.step === "awaiting_start") {
      state.startDate = selectedDate;
      state.step = "awaiting_end";
      bot3.editMessageText(`\u{1F4C5} *Step 2: Select END Date*

Selected Start: ${dateStr}`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: generateCalendarKeyboard(state.monthOffset, true)
        }
      });
    } else if (state.step === "awaiting_end") {
      state.endDate = selectedDate;
      state.step = "completed";
      if (state.startDate && state.endDate < state.startDate) {
        const temp = state.startDate;
        state.startDate = state.endDate;
        state.endDate = temp;
      }
      const startStr = state.startDate?.toISOString().split("T")[0];
      const endStr = state.endDate.toISOString().split("T")[0];
      bot3.editMessageText(`\u2705 *Range Configured Successfully:*
From: ${startStr}
To: ${endStr}

The bot will now search for dates within this range.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown"
      });
      Promise.resolve().then(() => (init_chatState(), chatState_exports)).then((chatStateMod) => {
        if (chatStateMod.fastBookingStates.has(chatId)) {
          Promise.resolve().then(() => (init_fastChatMenu(), fastChatMenu_exports)).then((fastMenu) => {
            fastMenu.showFastModeSummary(bot3, chatId);
          });
        }
      }).catch(() => {
      });
    }
    bot3.answerCallbackQuery(queryId);
    return true;
  }
  return false;
}
var dateRangeState;
var init_dateCalendarMenu = __esm({
  "src/automation/dateCalendarMenu.ts"() {
    dateRangeState = /* @__PURE__ */ new Map();
  }
});

// src/fastmode/finalConfirmation.ts
var finalConfirmation_exports = {};
__export(finalConfirmation_exports, {
  processFinalConfirmation: () => processFinalConfirmation
});
async function processFinalConfirmation(page, chatId, bot3) {
  await bot3.sendMessage(chatId, "\u23E9 Automating final confirmation page...");
  try {
    await page.evaluate(async () => {
      const chkTotal = document.querySelector("#chkTotal");
      if (chkTotal && !chkTotal.checked) {
        chkTotal.click();
      }
    });
    await page.waitForTimeout(1e3);
    await page.evaluate(async () => {
      const enviarCorreo = document.querySelector("#enviarCorreo");
      if (enviarCorreo && !enviarCorreo.checked) {
        enviarCorreo.click();
      }
    });
    await page.waitForTimeout(1e3);
    const btnClicked = await page.evaluate(() => {
      const btnConfirmar = document.querySelector("#btnConfirmar");
      if (btnConfirmar) {
        btnConfirmar.click();
        return true;
      }
      return false;
    });
    if (btnClicked) {
      await bot3.sendMessage(chatId, "\u23F3 Waiting for the final receipt to generate...");
      await page.waitForNavigation({ waitUntil: "load", timeout: 15e3 }).catch(() => {
      });
      await page.waitForTimeout(2e3);
    } else {
      await bot3.sendMessage(chatId, "\u26A0\uFE0F Could not find the final Confirm button, taking screenshot of current state.");
    }
  } catch (err) {
    console.error("Final confirmation error:", err);
    await bot3.sendMessage(chatId, `\u26A0\uFE0F Error clicking final confirm buttons: ${err.message}`);
  }
}
var init_finalConfirmation = __esm({
  "src/fastmode/finalConfirmation.ts"() {
  }
});

// src/fastmode/fastExecution.ts
var fastExecution_exports = {};
__export(fastExecution_exports, {
  executeFastLaunch: () => executeFastLaunch
});
async function solve2Captcha(base64Image, apiKey) {
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
  const submitRes = await fetch("https://2captcha.com/in.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: apiKey,
      method: "base64",
      body: cleanBase64,
      json: 1,
      numeric: 4,
      // Important: Extranjeria captchas are alphanumeric, let's allow both (0 = default, 4 = both)
      min_len: 4,
      max_len: 6
    })
  });
  const submitData = await submitRes.json();
  if (submitData.status !== 1) throw new Error("2Captcha submit error: " + submitData.request);
  const taskId = submitData.request;
  await new Promise((r) => setTimeout(r, 5e3));
  for (let i = 0; i < 20; i++) {
    const pollRes = await fetch(`https://2captcha.com/res.php?key=${apiKey}&action=get&id=${taskId}&json=1`);
    const pollData = await pollRes.json();
    if (pollData.status === 1) {
      return pollData.request;
    }
    if (pollData.request !== "CAPCHA_NOT_READY") {
      throw new Error("2Captcha poll error: " + pollData.request);
    }
    await new Promise((r) => setTimeout(r, 3e3));
  }
  throw new Error("2Captcha timeout");
}
async function humanDelay(page) {
  await page.waitForTimeout(Math.floor(Math.random() * 800) + 400);
}
async function executeFastLaunch(chatId) {
  const state = fastBookingStates.get(chatId);
  if (!state || !state.province || !state.nie || !state.name || !state.phone || !state.email) {
    await bot.sendMessage(chatId, "\u26A0\uFE0F Incomplete data. Cannot launch fast mode.");
    return;
  }
  await bot.sendMessage(chatId, "\u{1F680} Starting Auto-Pilot...\nInitializing stealth browser with proxy...");
  let browser;
  try {
    const sessionStr = import_crypto4.default.randomBytes(8).toString("hex");
    const randomPassword = `${PROXY_CONFIG.password}_session-${sessionStr}`;
    browser = await import_playwright_extra3.chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const context = await browser.newContext({
      proxy: {
        server: PROXY_CONFIG.server,
        username: PROXY_CONFIG.username,
        password: randomPassword
      },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "es-ES,es;q=0.9",
      timezoneId: "Europe/Madrid"
    });
    const page = await context.newPage();
    activeSessions.set(chatId, {
      browser,
      context,
      page,
      step: "fast_execution",
      lastInteraction: Date.now()
    });
    await bot.sendMessage(chatId, "\u{1F30D} Navigating to Extranjer\xEDa...");
    await page.goto("https://icp.administracionelectronica.gob.es/icpplus/index.html", { waitUntil: "domcontentloaded", timeout: 3e4 });
    await page.waitForSelector("select#form", { timeout: 1e4 });
    await humanDelay(page);
    await page.selectOption("select#form", state.province.value);
    await humanDelay(page);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 3e4 }).catch(() => {
      }),
      page.click("#btnAceptar")
    ]);
    await bot.sendMessage(chatId, `\u{1F3E2} Injecting Office & Tramite for ${state.province.text}...`);
    if (state.office && state.office.value && state.office.value !== "99") {
      try {
        await page.waitForSelector("select#sede", { timeout: 5e3 });
        await humanDelay(page);
        await page.selectOption("select#sede", state.office.value);
        await page.waitForTimeout(2e3);
      } catch (e) {
        console.log("Sede dropdown not found or changed.");
      }
    }
    if (state.tramite && state.tramite.value && state.tramite.value !== "-1") {
      try {
        const selects = await page.$$('select[name^="tramite"]');
        for (const sel of selects) {
          const html = await sel.innerHTML();
          if (html.includes(`value="${state.tramite.value}"`) || html.includes(`value='${state.tramite.value}'`)) {
            await sel.selectOption(state.tramite.value);
            break;
          }
        }
      } catch (e) {
        console.log("Tramite dropdown issue.");
      }
    }
    await humanDelay(page);
    const preUrlAceptar = page.url();
    await page.evaluate(() => {
      const btn = document.querySelector("#btnAceptar");
      if (btn) btn.click();
    });
    await page.waitForNavigation({ waitUntil: "load", timeout: 3e4 }).catch(() => {
    });
    if (page.url() === preUrlAceptar) {
      await page.click("#btnAceptar").catch(() => {
      });
      await page.waitForSelector("#btnEntrar, #txtIdCitante", { timeout: 3e4 }).catch(() => {
      });
    }
    await bot.sendMessage(chatId, "\u23E9 Bypassing Information Page...");
    await page.waitForLoadState("domcontentloaded");
    const preUrlEntrar = page.url();
    await page.evaluate(() => {
      const btnEntrar = document.querySelector("#btnEntrar");
      if (btnEntrar) btnEntrar.click();
    });
    await bot.sendMessage(chatId, "\u{1F4DD} Filling NIE & Name...");
    await page.waitForSelector("#txtIdCitante, #txtIdCitado, #btnEntrar", { timeout: 15e3 }).catch(() => {
    });
    await page.evaluate(() => {
      const btnEntrar = document.querySelector("#btnEntrar");
      if (btnEntrar) btnEntrar.click();
    });
    await page.waitForSelector("#txtIdCitante, #txtIdCitado", { timeout: 15e3 }).catch(() => {
    });
    await page.evaluate((data) => {
      const setVal = (sel, val) => {
        const el = document.querySelector(sel);
        if (el && val) {
          el.value = val;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      };
      const radioId = document.querySelector('input[value="NIE"]');
      if (radioId) radioId.checked = true;
      setVal("#txtIdCitante", data.nie);
      setVal("#txtIdCitado", data.nie);
      setVal("#txtDesCitante", data.name);
      setVal("#txtDesCitado", data.name);
      setVal('input[name="txtDesCitante"]', data.name);
      setVal('input[name="txtDesCitado"]', data.name);
    }, { nie: state.nie, name: state.name });
    await humanDelay(page);
    const preUrlNie = page.url();
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("input, button, a"));
      for (const btn of btns) {
        const txt = (btn.textContent || btn.value || "").toLowerCase();
        if (txt.includes("aceptar") || txt.includes("enviar") || txt.includes("siguiente")) {
          btn.click();
          return;
        }
      }
      const specific = document.querySelector('#btnEnviar, #btnSiguiente, input[value="Siguiente"]');
      if (specific) specific.click();
    });
    await page.waitForNavigation({ waitUntil: "load", timeout: 3e4 }).catch(() => {
    });
    if (page.url() === preUrlNie) {
      await page.click('#btnEnviar, #btnSiguiente, input[value="Siguiente"], input[name="btnSiguiente"]').catch(() => {
      });
      await page.waitForNavigation({ waitUntil: "load", timeout: 3e4 }).catch(() => {
      });
    }
    await bot.sendMessage(chatId, "\u23E9 Clicking 'Solicitar Cita'...");
    const preUrlCita = page.url();
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("input, button, a"));
      for (const btn of btns) {
        const txt = (btn.textContent || btn.value || "").toLowerCase();
        if (txt.includes("solicitar cita")) {
          btn.click();
          return;
        }
      }
    });
    await page.waitForNavigation({ waitUntil: "load", timeout: 3e4 }).catch(() => {
    });
    if (page.url() === preUrlCita) {
      await page.click('#btnEnviar, input[value="Solicitar Cita"], input[name="btnEnviar"]').catch(() => {
      });
      await page.waitForNavigation({ waitUntil: "load", timeout: 3e4 }).catch(() => {
      });
    }
    const hasOfficeSelect = await page.evaluate(() => !!document.querySelector('select#idSede, select[name="idSede"]'));
    if (hasOfficeSelect) {
      await bot.sendMessage(chatId, "\u{1F3E2} Intercepted Office Selection step. Auto-selecting random office...");
      const selectedOfficeName = await page.evaluate(() => {
        const officeSelect = document.querySelector('select#idSede, select[name="idSede"]');
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
        const btns = Array.from(document.querySelectorAll("input, button, a"));
        for (const btn of btns) {
          const txt = (btn.textContent || btn.value || "").toLowerCase();
          if (txt.includes("siguiente") || txt.includes("continuar")) {
            btn.click();
            return;
          }
        }
        const specific = document.querySelector('#btnSiguiente, input[value="Siguiente"]');
        if (specific) specific.click();
      });
      await page.waitForNavigation({ waitUntil: "load", timeout: 3e4 }).catch(() => {
      });
      if (page.url() === preUrlOffice) {
        await page.click('#btnSiguiente, input[value="Siguiente"], input[name="btnSiguiente"]').catch(() => {
        });
        await page.waitForNavigation({ waitUntil: "load", timeout: 3e4 }).catch(() => {
        });
      }
    }
    await bot.sendMessage(chatId, "\u{1F4DE} Filling Phone & Email...");
    await page.waitForSelector('#txtTelefonoMac, #txtTelefono, input[type="tel"], input[name="txtTelefonoMac"], input[name="txtTelefonoCitante"], input[name="txtTelefonoCitado"]', { timeout: 15e3 }).catch(() => {
    });
    await page.evaluate((data) => {
      const setVal = (sel, val) => {
        const el = document.querySelector(sel);
        if (el && val) {
          el.value = val;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      };
      setVal("#txtTelefonoMac", data.phone);
      setVal("#txtTelefono", data.phone);
      setVal('input[type="tel"]', data.phone);
      setVal('input[name="txtTelefonoMac"]', data.phone);
      setVal('input[name="txtTelefonoCitante"]', data.phone);
      setVal('input[name="txtTelefonoCitado"]', data.phone);
      setVal("#txtCorreoElectronico", data.email);
      setVal("#email", data.email);
      setVal('input[type="email"]:not([id*="DOS"])', data.email);
      setVal('input[name="txtCorreoElectronico"]', data.email);
      setVal("#emailDOS", data.email);
      setVal('input[name="emailDOS"]', data.email);
      setVal("#txtRepiteCorreoElectronico", data.email);
      setVal('input[name="txtRepiteCorreoElectronico"]', data.email);
    }, { phone: state.phone, email: state.email });
    await humanDelay(page);
    const btnSelectorSiguiente = '#btnSiguiente, input[value="Next "], input[value="Siguiente"], input[name="btnSiguiente"]';
    const preUrlContact = page.url();
    await page.evaluate((sel) => {
      const btns = Array.from(document.querySelectorAll("input, button, a"));
      for (const btn of btns) {
        const txt = (btn.textContent || btn.value || "").toLowerCase();
        if (txt.includes("siguiente") || txt.includes("continuar")) {
          btn.click();
          return;
        }
      }
      const specific = document.querySelector(sel);
      if (specific) specific.click();
    }, btnSelectorSiguiente);
    await page.waitForNavigation({ waitUntil: "load", timeout: 3e4 }).catch(() => {
    });
    if (page.url() === preUrlContact) {
      await page.click(btnSelectorSiguiente).catch(() => {
      });
      await page.waitForNavigation({ waitUntil: "load", timeout: 3e4 }).catch(() => {
      });
    }
    await humanDelay(page);
    const noAppointments = await page.locator('text="En este momento no hay citas disponibles"').count();
    if (noAppointments > 0) {
      await bot.sendMessage(chatId, "\u274C No hay citas disponibles (No appointments available right now). Session will close.");
      activeSessions.delete(chatId);
      await browser.close();
      return;
    }
    try {
      const calMod = await Promise.resolve().then(() => (init_dateCalendarMenu(), dateCalendarMenu_exports));
      const dState = calMod.dateRangeState.get(chatId);
      if (dState && dState.startDate && dState.endDate) {
        await bot.sendMessage(chatId, `\u{1F50D} Searching for dates between ${dState.startDate.toISOString().split("T")[0]} and ${dState.endDate.toISOString().split("T")[0]}...`);
        const startStr = dState.startDate.toISOString().split("T")[0];
        const endStr = dState.endDate.toISOString().split("T")[0];
        const matchFound = await page.evaluate(({ start, end }) => {
          const startDate = new Date(start);
          const endDate = new Date(end);
          const header = document.querySelector(".ui-datepicker-title");
          if (!header) return false;
          const monthText = header.querySelector(".ui-datepicker-month")?.textContent?.trim().toLowerCase();
          const yearText = header.querySelector(".ui-datepicker-year")?.textContent?.trim();
          if (!monthText || !yearText) return false;
          const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
          const monthIdx = months.indexOf(monthText);
          const year = parseInt(yearText, 10);
          const days = Array.from(document.querySelectorAll('.ui-datepicker-calendar td[data-handler="selectDay"] a'));
          for (const dayEl of days) {
            const day = parseInt(dayEl.textContent?.trim() || "0", 10);
            if (day > 0) {
              const dateObj = new Date(year, monthIdx, day);
              if (dateObj >= startDate && dateObj <= endDate) {
                dayEl.click();
                return true;
              }
            }
          }
          return false;
        }, { start: startStr, end: endStr });
        if (matchFound) {
          await bot.sendMessage(chatId, "\u2705 Found a date in your range! Selected it.");
        } else {
          await bot.sendMessage(chatId, "\u26A0\uFE0F No dates found in your requested range. Defaulting to first available.");
          await page.evaluate(() => {
            const firstAvailableDay = document.querySelector('.ui-datepicker-calendar td[data-handler="selectDay"] a');
            if (firstAvailableDay) {
              firstAvailableDay.click();
            }
          });
        }
        await bot.sendMessage(chatId, "\u23F3 Waiting 5 seconds after selecting date...");
        await page.waitForTimeout(5e3);
        const apiKey2Captcha = "f1a54d48c9e0ebf667fd90f29117deca";
        let captchaSuccess = false;
        try {
          await bot.sendMessage(chatId, "\u{1F916} Grabbing Captcha image & sending to 2Captcha...");
          const imgLocator = page.locator('img[alt="captcha" i], img.img-thumbnail, #captcha').first();
          await imgLocator.waitFor({ state: "visible", timeout: 8e3 });
          const imgSrc = await imgLocator.evaluate((el) => el.src);
          let base64Data = "";
          if (imgSrc && imgSrc.startsWith("data:image")) {
            base64Data = imgSrc;
          } else {
            const imgBuffer = await imgLocator.screenshot({ type: "jpeg", quality: 100 });
            base64Data = imgBuffer.toString("base64");
          }
          await bot.sendMessage(chatId, "\u23F3 Waiting for 2Captcha to finish solving (usually 10-15 seconds)...");
          const captchaText = await solve2Captcha(base64Data, apiKey2Captcha);
          await bot.sendMessage(chatId, `\u2705 2Captcha Solved: ${captchaText}. Filling form...`);
          await page.evaluate((text) => {
            const inputSelectors = [
              'input[placeholder*="texto" i]',
              'input[placeholder*="captcha" i]',
              "#txtCaptcha",
              "#txtCodigoSeguridad",
              'input[name="txtCaptcha"]',
              'input[name="captcha"]'
            ];
            let foundInput = null;
            for (const sel of inputSelectors) {
              const el = document.querySelector(sel);
              if (el) {
                foundInput = el;
                break;
              }
            }
            if (!foundInput) {
              const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
              foundInput = inputs.find((i) => !i.value && i.closest("form"));
            }
            if (foundInput) {
              foundInput.value = text;
              foundInput.dispatchEvent(new Event("input", { bubbles: true }));
              foundInput.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }, captchaText);
          captchaSuccess = true;
          await bot.sendMessage(chatId, "\u23F3 Waiting 5 seconds after filling captcha...");
          await page.waitForTimeout(5e3);
        } catch (e) {
          console.error("Captcha error:", e);
          await bot.sendMessage(chatId, `\u26A0\uFE0F Auto-solve failed: ${e.message}`);
        }
        await bot.sendMessage(chatId, "\u23E9 Selecting 'LIBRE' time...");
        await page.evaluate(() => {
          const cookieBtns = Array.from(document.querySelectorAll("a, button, input"));
          for (const btn of cookieBtns) {
            const txt = (btn.textContent || btn.value || "").trim().toLowerCase();
            if (txt === "acepto" || txt === "aceptar") {
              btn.click();
            }
          }
          const chk = document.querySelector('input[name="chkInfoAdicional"]');
          if (chk && !chk.checked) chk.click();
          const allLinks = Array.from(document.querySelectorAll("a"));
          for (const link of allLinks) {
            const text = (link.textContent || "").trim().toUpperCase();
            if (text === "LIBRE" || link.id && link.id.startsWith("HUECO")) {
              link.click();
              return;
            }
          }
          const allElements = document.querySelectorAll('button, span, td, div[role="button"]');
          for (const el of Array.from(allElements)) {
            const text = (el.textContent || "").trim().toUpperCase();
            if (text === "LIBRE") {
              el.click();
              return;
            }
          }
        });
        await bot.sendMessage(chatId, "\u23F3 Waiting 5 seconds after clicking 'LIBRE' time...");
        await page.waitForTimeout(5e3);
        await bot.sendMessage(chatId, "\u23E9 Clicking 'S\xED' or 'Ci' on the confirmation popup...");
        await page.evaluate(() => {
          const confirmBtns = Array.from(document.querySelectorAll(".jconfirm-buttons button"));
          for (const btn of confirmBtns) {
            const txt = (btn.textContent || "").trim().toLowerCase();
            if (txt === "s\xED" || txt === "si" || txt === "ci" || txt === "yes") {
              btn.click();
              return;
            }
          }
        });
        if (captchaSuccess) {
          await bot.sendMessage(chatId, "\u23F3 Waiting 8 seconds for the next page to load...");
          await page.waitForTimeout(8e3);
          const { processFinalConfirmation: processFinalConfirmation2 } = await Promise.resolve().then(() => (init_finalConfirmation(), finalConfirmation_exports));
          await processFinalConfirmation2(page, chatId, bot);
          const finalBuffer = await page.screenshot({ fullPage: true });
          await bot.sendPhoto(chatId, finalBuffer, { caption: "\u{1F389} Action Completed! Final Receipt screenshot:" });
        } else {
          const buffer = await page.screenshot({ fullPage: true });
          await bot.sendPhoto(chatId, buffer, { caption: "\u26A0\uFE0F Stopped at Captcha page (Auto-solve failed). Session remains open." });
        }
      }
    } catch (e) {
      console.error("Date logic error:", e);
    }
    const session = activeSessions.get(chatId);
    if (session) {
      session.timeoutId = setTimeout(async () => {
        await bot.sendMessage(chatId, "\u23F3 Session expired due to 10 minutes of inactivity.");
        const { cleanupSession: cleanupSession5 } = await Promise.resolve().then(() => (init_botContext(), botContext_exports));
        cleanupSession5(chatId);
      }, 10 * 60 * 1e3);
    }
  } catch (err) {
    console.error("Fast Execution Error:", err);
    await bot.sendMessage(chatId, `\u274C Error during Auto-Pilot: ${err.message}`);
    if (browser) await browser.close();
    activeSessions.delete(chatId);
  }
}
var import_playwright_extra3, import_puppeteer_extra_plugin_stealth3, import_crypto4;
var init_fastExecution = __esm({
  "src/fastmode/fastExecution.ts"() {
    import_playwright_extra3 = require("playwright-extra");
    import_puppeteer_extra_plugin_stealth3 = __toESM(require("puppeteer-extra-plugin-stealth"), 1);
    import_crypto4 = __toESM(require("crypto"), 1);
    init_botContext();
    init_chatState();
    import_playwright_extra3.chromium.use((0, import_puppeteer_extra_plugin_stealth3.default)());
  }
});

// src/fastmode/fastChatMenu.ts
var fastChatMenu_exports = {};
__export(fastChatMenu_exports, {
  handleFastChatCallback: () => handleFastChatCallback,
  handleFastChatText: () => handleFastChatText,
  showDraftProfiles: () => showDraftProfiles,
  showFastModeSummary: () => showFastModeSummary,
  startFastChat: () => startFastChat
});
function handleFastChatCallback(bot3, chatId, data, queryId, messageId) {
  console.log("FASTCHAT CALLBACK RECEIVED:", { chatId, data, queryId, messageId });
  const db2 = loadFastDb();
  const state = fastBookingStates.get(chatId);
  const sendOrEdit = (text, markup) => {
    if (messageId) {
      bot3.editMessageText(text, { chat_id: chatId, message_id: messageId, reply_markup: markup }).catch((e) => {
        bot3.sendMessage(chatId, text, { reply_markup: markup });
      });
    } else {
      bot3.sendMessage(chatId, text, { reply_markup: markup });
    }
  };
  if (data === "fm_ignore") {
    bot3.answerCallbackQuery(queryId);
    return true;
  }
  if (data.startsWith("fm_launch_prof_")) {
    const profId = data.replace("fm_launch_prof_", "");
    const profile = db2.profiles?.find((p) => p.id === profId);
    if (profile) {
      fastBookingStates.set(chatId, {
        step: "ready",
        province: profile.province,
        office: profile.office,
        tramite: profile.tramite,
        nie: profile.nie,
        name: profile.userName,
        phone: profile.phone,
        email: profile.email
      });
      sendOrEdit(`\u{1F680} Queuing Fast Auto-Pilot for Profile: ${profile.name}...`);
      bot3.answerCallbackQuery(queryId);
      Promise.resolve().then(() => (init_queue(), queue_exports)).then((queueMod) => {
        const { browserQueue: browserQueue2 } = queueMod;
        browserQueue2.enqueue(async () => {
          const fastExec = await Promise.resolve().then(() => (init_fastExecution(), fastExecution_exports));
          await fastExec.executeFastLaunch(chatId);
        }, (pos) => {
          bot3.sendMessage(chatId, `\u23F3 Profile ${profile.name} in queue (Position: ${pos}). Launching soon...`);
        });
      }).catch((e) => {
        Promise.resolve().then(() => (init_fastExecution(), fastExecution_exports)).then((mod) => mod.executeFastLaunch(chatId));
      });
    } else {
      bot3.answerCallbackQuery(queryId, { text: "Profile not found!" });
    }
    return true;
  }
  if (data.startsWith("fm_del_prof_")) {
    const profId = data.replace("fm_del_prof_", "");
    db2.profiles = db2.profiles?.filter((p) => p.id !== profId) || [];
    saveFastDb(db2);
    bot3.answerCallbackQuery(queryId, { text: "Profile Deleted!" });
    showDraftProfiles(bot3, chatId, messageId);
    return true;
  }
  if (!state) return false;
  if (data === "fm_save_draft") {
    state.step = "awaiting_profile_name";
    sendOrEdit("\u{1F4BE} Please reply with a short Name/Title for this Draft Profile (e.g., Client Ali, Madrid TIE):");
    bot3.answerCallbackQuery(queryId);
    return true;
  }
  if (data.startsWith("fm_prov_")) {
    const val = data.replace("fm_prov_", "");
    const prov = db2.provinces.find((p) => p.value === val);
    if (prov) {
      state.province = prov;
      const offices = db2.offices[val] || [];
      const tramites = db2.tramites[val] || [];
      if (offices.length > 0) {
        state.step = "office";
        const kb = offices.map((o) => [{ text: o.text.substring(0, 60), callback_data: `fm_off_${o.value}` }]);
        sendOrEdit(`\u{1F3E2} Selected Province: ${prov.text}

Select Office:`, { inline_keyboard: kb });
      } else if (tramites.length > 0) {
        state.step = "tramite";
        const kb = tramites.map((t) => [{ text: t.text.substring(0, 60), callback_data: `fm_tra_${t.value}` }]);
        sendOrEdit(`\u{1F4C4} Selected Province: ${prov.text}
No offices found. Select Tramite:`, { inline_keyboard: kb });
      } else {
        state.step = "nie";
        sendOrEdit(`\u26A0\uFE0F No offices or tramites saved in database for ${prov.text}. Proceeding anyway.

\u{1F4DD} Please reply with NIE/DNI:`);
      }
    }
    bot3.answerCallbackQuery(queryId);
    return true;
  }
  if (data.startsWith("fm_off_")) {
    const val = data.replace("fm_off_", "");
    const provVal = state.province.value;
    const office = db2.offices[provVal]?.find((o) => o.value === val);
    if (office) {
      state.office = office;
      state.step = "tramite";
      let tramites = db2.tramites[provVal] || [];
      if (tramites.length === 0) {
        for (const key in db2.tramites) {
          if (key.includes(provVal.split("&")[0])) {
            tramites = db2.tramites[key];
            break;
          }
        }
      }
      if (!Array.isArray(tramites)) {
        tramites = Object.values(tramites);
      }
      console.log("Found tramites for province:", provVal, tramites.length);
      const kb = tramites.map((t) => [{ text: t.text.substring(0, 60), callback_data: `fm_tra_${t.value}` }]);
      if (kb.length > 0) {
        sendOrEdit(`\u{1F3E2} Selected Office: ${office.text}

Select Tramite:`, { inline_keyboard: kb });
      } else {
        state.step = "nie";
        sendOrEdit("\u{1F4DD} No tramites saved in database for this province! Admin needs to scrape it. Please reply with NIE/DNI anyway to bypass:");
      }
    }
    bot3.answerCallbackQuery(queryId);
    return true;
  }
  if (data.startsWith("fm_tra_")) {
    const val = data.replace("fm_tra_", "");
    const provVal = state.province.value;
    const tramite = db2.tramites[provVal]?.find((t) => t.value === val);
    if (tramite) {
      state.tramite = tramite;
      state.step = "nie";
      sendOrEdit(`\u2705 Tramite Selected: ${tramite.text}

\u{1F4DD} Please reply with NIE/DNI:`);
    }
    bot3.answerCallbackQuery(queryId);
    return true;
  }
  if (data === "fm_launch_real") {
    sendOrEdit("\u{1F680} Queuing Fast Auto-Pilot Mode...");
    bot3.answerCallbackQuery(queryId);
    Promise.resolve().then(() => (init_queue(), queue_exports)).then((queueMod) => {
      const { browserQueue: browserQueue2 } = queueMod;
      browserQueue2.enqueue(async () => {
        const fastExec = await Promise.resolve().then(() => (init_fastExecution(), fastExecution_exports));
        await fastExec.executeFastLaunch(chatId);
      }, (pos) => {
        bot3.sendMessage(chatId, `\u23F3 You are in queue (Position: ${pos}). Fast browser will launch soon...`);
      });
    }).catch((e) => {
      console.error(e);
      bot3.sendMessage(chatId, "Failed to load queue. Falling back to direct launch.");
      Promise.resolve().then(() => (init_fastExecution(), fastExecution_exports)).then((mod) => mod.executeFastLaunch(chatId));
    });
    return true;
  }
  return false;
}
function showFastModeSummary(bot3, chatId) {
  const state = fastBookingStates.get(chatId);
  if (!state) return;
  let summary = `\u2705 **Data Collection Complete!**

`;
  summary += `\u{1F4CD} Province: ${state.province?.text}
`;
  if (state.office) summary += `\u{1F3E2} Office: ${state.office?.text}
`;
  if (state.tramite) summary += `\u{1F4C4} Tramite: ${state.tramite?.text}
`;
  summary += `\u{1F194} NIE: ${state.nie}
`;
  summary += `\u{1F464} Name: ${state.name}
`;
  summary += `\u{1F4DE} Phone: ${state.phone}
`;
  summary += `\u{1F4E7} Email: ${state.email}

`;
  summary += `Click below to launch the real browser in fast mode, or save as a draft!`;
  bot3.sendMessage(chatId, summary, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "\u{1F680} Launch Real Browser", callback_data: "fm_launch_real" }],
        [{ text: "\u{1F4BE} Save as Draft Profile", callback_data: "fm_save_draft" }]
      ]
    }
  });
}
function showDraftProfiles(bot3, chatId, editMessageId) {
  const db2 = loadFastDb();
  const profiles = db2.profiles || [];
  if (profiles.length === 0) {
    const text2 = "\u{1F4C2} *No Draft Profiles Found*\n\nYou haven't saved any profiles yet. Create one by completing the Fast Mode flow and clicking 'Save as Draft Profile'.";
    if (editMessageId) {
      bot3.editMessageText(text2, { chat_id: chatId, message_id: editMessageId, parse_mode: "Markdown" }).catch(() => {
      });
    } else {
      bot3.sendMessage(chatId, text2, { parse_mode: "Markdown" });
    }
    return;
  }
  const inline_keyboard = [];
  profiles.forEach((p) => {
    inline_keyboard.push([{ text: `\u{1F464} ${p.name.substring(0, 35)}`, callback_data: `fm_ignore` }]);
    inline_keyboard.push([
      { text: `\u25B6\uFE0F Launch`, callback_data: `fm_launch_prof_${p.id}` },
      { text: `\u{1F5D1}\uFE0F Delete`, callback_data: `fm_del_prof_${p.id}` }
    ]);
  });
  const text = "\u{1F4C2} *Your Saved Draft Profiles:*\n\n\u{1F447} Manage and launch your profiles instantly:";
  if (editMessageId) {
    bot3.editMessageText(text, { chat_id: chatId, message_id: editMessageId, parse_mode: "Markdown", reply_markup: { inline_keyboard } }).catch((e) => {
      bot3.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup: { inline_keyboard } });
    });
  } else {
    bot3.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup: { inline_keyboard } });
  }
}
function handleFastChatText(bot3, chatId, text) {
  const state = fastBookingStates.get(chatId);
  if (!state) return false;
  if (state.step === "awaiting_profile_name") {
    const db2 = loadFastDb();
    const profileId = import_crypto5.default.randomUUID();
    const newProfile = {
      id: profileId,
      name: text.trim(),
      province: state.province,
      office: state.office,
      tramite: state.tramite,
      nie: state.nie,
      userName: state.name,
      phone: state.phone,
      email: state.email
    };
    db2.profiles = db2.profiles || [];
    db2.profiles.push(newProfile);
    saveFastDb(db2);
    state.step = "ready";
    bot3.sendMessage(chatId, `\u2705 Draft Profile **"${newProfile.name}"** saved successfully!
You can launch it anytime from the Drafts menu.`);
    return true;
  }
  if (state.step === "nie") {
    state.nie = text.trim();
    state.step = "name";
    bot3.sendMessage(chatId, "\u{1F4DD} Please reply with Full Name:");
    return true;
  }
  if (state.step === "name") {
    state.name = text.trim();
    state.step = "phone";
    bot3.sendMessage(chatId, "\u{1F4F1} Please reply with Phone Number:");
    return true;
  }
  if (state.step === "phone") {
    state.phone = text.trim();
    state.step = "email";
    bot3.sendMessage(chatId, "\u{1F4E7} Please reply with Email:");
    return true;
  }
  if (state.step === "email") {
    state.email = text.trim();
    state.step = "ready";
    bot3.sendMessage(chatId, "\u2705 Contact info saved. Now let's set the date range.");
    Promise.resolve().then(() => (init_dateCalendarMenu(), dateCalendarMenu_exports)).then((cal) => {
      cal.sendDateSelectionMenu(bot3, chatId);
    });
    return true;
  }
  return false;
}
function startFastChat(bot3, chatId) {
  console.log("START FAST CHAT CALLED FOR:", chatId);
  fastBookingStates.delete(chatId);
  const db2 = loadFastDb();
  if (db2.provinces.length === 0) {
    bot3.sendMessage(chatId, "\u26A0\uFE0F Database is empty. Admin needs to scrape provinces first using '\u{1F4BE} Admin: Scrape Data'.");
    return;
  }
  fastBookingStates.set(chatId, { step: "province" });
  const inlineKeyboard = [];
  let row = [];
  for (let i = 0; i < db2.provinces.length; i++) {
    row.push({ text: db2.provinces[i].text, callback_data: `fm_prov_${db2.provinces[i].value}` });
    if (row.length === 3 || i === db2.provinces.length - 1) {
      inlineKeyboard.push(row);
      row = [];
    }
  }
  bot3.sendMessage(chatId, "\u26A1 FAST MODE: Select Province (From DB):", { reply_markup: { inline_keyboard: inlineKeyboard } });
}
var import_crypto5;
var init_fastChatMenu = __esm({
  "src/fastmode/fastChatMenu.ts"() {
    init_db();
    init_chatState();
    import_crypto5 = __toESM(require("crypto"), 1);
  }
});

// src/automation/handleDynamicClick.ts
var handleDynamicClick_exports = {};
__export(handleDynamicClick_exports, {
  handleDynamicClick: () => handleDynamicClick
});
async function handleDynamicClick(chatId, queryId, index) {
  const session = activeSessions.get(chatId);
  if (!session) {
    await bot.sendMessage(chatId, "\u26A0\uFE0F Session expired. Please click 'Launch Cloud Browser' again.");
    await bot.answerCallbackQuery(queryId);
    return;
  }
  const { page, dynamicButtons } = session;
  const selectedBtn = dynamicButtons?.find((b) => b.index === index);
  if (!selectedBtn) {
    await bot.sendMessage(chatId, "\u26A0\uFE0F Invalid button selection.");
    await bot.answerCallbackQuery(queryId);
    return;
  }
  await bot.sendMessage(chatId, `\u{1F504} Clicking button: '${selectedBtn.text}'...`);
  await bot.answerCallbackQuery(queryId);
  if (isClaveButton(selectedBtn.text)) {
    console.log("[CLAVE] Detected Cl@ve button, initiating authentication flow");
    const intercepted = await handleClaveAuthCheck(chatId, queryId, async () => {
      console.log("[CLAVE] Certificate and password ready, calling handleClaveClickWithCert");
      await handleClaveClickWithCert(chatId, selectedBtn.selector);
    });
    if (intercepted) {
      console.log("[CLAVE] Intercepted - waiting for cert/password upload");
      return;
    }
    console.log("[CLAVE] Authentication flow completed, returning without normal click");
    return;
  }
  try {
    const preUrl = page.url();
    await page.hover(selectedBtn.selector).catch(() => {
    });
    await page.waitForTimeout(Math.floor(Math.random() * 400) + 200);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "load", timeout: 45e3 }).catch(() => {
      }),
      page.click(selectedBtn.selector, { delay: Math.floor(Math.random() * 150) + 50 }).catch(() => {
      })
    ]);
    if (page.url() === preUrl) {
      await bot.sendMessage(chatId, "\u26A0\uFE0F URL didn't change via native click. Retrying via trusted event...");
      await Promise.all([
        page.waitForNavigation({ waitUntil: "load", timeout: 45e3 }).catch(() => {
        }),
        page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) {
            el.click();
            const evt = new MouseEvent("click", { view: window, bubbles: true, cancelable: true });
            el.dispatchEvent(evt);
          }
        }, selectedBtn.selector).catch(() => {
        })
      ]);
    }
    await bot.sendMessage(chatId, "\u23F3 Waiting 8 seconds for the new page to render...");
    await page.waitForTimeout(8e3);
    await bot.sendMessage(chatId, "\u{1F50D} Scraping available actions/buttons on this new page...");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1e3);
    const newDynamicButtons = await page.evaluate(() => {
      const foundBtns = [];
      const buttonTargets = [
        { id: "btnEntrar", label: "Entrar (Sin Cl@ve)", selectors: ["#btnEntrar", 'input[value="Entrar"]', 'input[name="btnEntrar"]'] },
        { id: "btnClave", label: "Acceder con Cl@ve", selectors: ["#btnAccesoClave", "#btnEnviarClave", 'input[value*="Cl@ve"]', 'input[value*="Clave"]', 'input[name*="clave"]', 'img[alt*="Cl@ve"]', 'a[href*="clave"]', 'button[title*="Cl@ve"]', 'button[id*="clave"]', ".botonClave", "#clave"] },
        { id: "btnAceptar", label: "Aceptar", selectors: ["#btnAceptar", 'input[value="Aceptar"]'] },
        { id: "btnSiguiente", label: "Siguiente / Continuar", selectors: ["#btnSiguiente", 'input[value="Siguiente"]', 'input[value="Continuar"]'] }
      ];
      let idx = 0;
      for (const target of buttonTargets) {
        let foundForTarget = false;
        for (const sel of target.selectors) {
          const elements = document.querySelectorAll(sel);
          if (elements.length > 0) {
            for (const el of Array.from(elements)) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                let finalSelector = sel;
                if (el.id) {
                  finalSelector = "#" + el.id;
                } else if (el.name) {
                  finalSelector = el.tagName.toLowerCase() + '[name="' + el.name + '"]';
                } else {
                  el.setAttribute("data-bot-id", "fastbtn-" + idx);
                  finalSelector = '[data-bot-id="fastbtn-' + idx + '"]';
                }
                foundBtns.push({
                  text: target.label,
                  selector: finalSelector,
                  index: idx
                });
                idx++;
                foundForTarget = true;
                break;
              }
            }
            if (foundForTarget) break;
          }
        }
      }
      const claveAlreadyFound = foundBtns.some((b) => b.text.includes("Cl@ve"));
      if (!claveAlreadyFound) {
        const allElements = document.querySelectorAll('img, button, input[type="image"], a');
        for (const el of Array.from(allElements)) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const text = (el.alt || el.title || el.src || el.href || el.innerText || el.value || "").toLowerCase();
            if (text.includes("cl@ve") || text.includes("clave")) {
              let finalSelector = "";
              if (el.id) {
                finalSelector = "#" + el.id;
              } else {
                el.setAttribute("data-bot-id", "fastbtn-fallback-" + idx);
                finalSelector = '[data-bot-id="fastbtn-fallback-' + idx + '"]';
              }
              foundBtns.push({
                text: "Acceder con Cl@ve (Found via Scan)",
                selector: finalSelector,
                index: idx
              });
              idx++;
              break;
            }
          }
        }
      }
      return foundBtns;
    });
    session.dynamicButtons = newDynamicButtons;
    await bot.sendMessage(chatId, "\u{1F4F8} Next page loaded. Taking screenshot...");
    const screenshotBuffer = await page.screenshot({
      timeout: 3e4,
      animations: "disabled",
      type: "jpeg",
      quality: 40
    });
    const inline_keyboard = [];
    if (newDynamicButtons && newDynamicButtons.length > 0) {
      newDynamicButtons.forEach((btn) => {
        inline_keyboard.push([{ text: "\u{1F5B1}\uFE0F " + btn.text, callback_data: "dyn_" + btn.index }]);
      });
    }
    inline_keyboard.push([{ text: "\u{1F4DD} Autofill Form (NIE/Name) [Fallback]", callback_data: "autofill_form" }]);
    await bot.sendPhoto(chatId, screenshotBuffer, {
      caption: `\u2705 Clicked: ${selectedBtn.text}
Here is the new page. You can continue clicking buttons, or proceed to Autofill if it's the right page:`,
      reply_markup: { inline_keyboard }
    });
    await persistSessionState(chatId);
    clearTimeout(session.timeoutId);
    session.timeoutId = setTimeout(async () => {
      await bot.sendMessage(chatId, "\u23F3 Session expired due to 10 minutes of inactivity.");
      cleanupSession(chatId);
    }, 10 * 60 * 1e3);
  } catch (error) {
    await bot.sendMessage(chatId, `\u274C Error during click:\${error.message}\u{1F4F8} Taking debug screenshot...`);
    try {
      const errImg = await page.screenshot({ timeout: 15e3, type: "jpeg", quality: 40 });
      await bot.sendPhoto(chatId, errImg, { caption: "Debug screenshot of the error state." });
    } catch (e) {
    }
  }
}
var init_handleDynamicClick = __esm({
  "src/automation/handleDynamicClick.ts"() {
    init_botContext();
    init_handleClaveAuth();
  }
});

// server.ts
var import_config = require("dotenv/config");

// src/automation/handleContactInfo.ts
init_botContext();
async function handleContactInfo(chatId, queryId, phone, email) {
  const session = activeSessions.get(chatId);
  if (!session) {
    await bot.sendMessage(chatId, "\u26A0\uFE0F Session expired. Please click 'Launch Cloud Browser' again.");
    if (queryId) await bot.answerCallbackQuery(queryId).catch(() => {
    });
    return;
  }
  const { page } = session;
  await bot.sendMessage(chatId, `\u{1F504} Autofilling contact info with Phone: ${phone} and Email: ${email}...`);
  if (queryId) await bot.answerCallbackQuery(queryId).catch(() => {
  });
  try {
    await page.evaluate((data) => {
      const setVal = (sel, val) => {
        const el = document.querySelector(sel);
        if (el && val) {
          el.value = val;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      };
      setVal("#txtTelefonoMac", data.phone);
      setVal("#txtTelefono", data.phone);
      setVal('input[type="tel"]', data.phone);
      setVal('input[name="txtTelefonoMac"]', data.phone);
      setVal("#txtCorreoElectronico", data.email);
      setVal("#email", data.email);
      setVal('input[type="email"]:not([id*="DOS"])', data.email);
      setVal('input[name="txtCorreoElectronico"]', data.email);
      setVal("#email", data.email);
      setVal("#emailDOS", data.email);
      setVal('input[name="emailDOS"]', data.email);
      setVal("#txtRepiteCorreoElectronico", data.email);
      setVal('input[name="txtRepiteCorreoElectronico"]', data.email);
      const emailDosEl = document.getElementById("emailDOS");
      if (emailDosEl) {
        emailDosEl.value = data.email;
        emailDosEl.dispatchEvent(new Event("input", { bubbles: true }));
        emailDosEl.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }, { phone, email });
    await bot.sendMessage(chatId, "\u2705 Contact data filled. Adding human delay before clicking Next...");
    await page.waitForTimeout(Math.floor(Math.random() * 1500) + 1e3);
    const preUrl = page.url();
    const btnSelector = '#btnSiguiente, input[value="Next "], input[value="Siguiente"], input[name="btnSiguiente"]';
    await page.evaluate((sel) => {
      const btns = Array.from(document.querySelectorAll("input, button, a"));
      for (const btn of btns) {
        const txt = (btn.textContent || btn.value || "").toLowerCase();
        if (txt.includes("siguiente") || txt.includes("continuar")) {
          btn.click();
          return;
        }
      }
      const specific = document.querySelector(sel);
      if (specific) specific.click();
    }, btnSelector);
    await page.waitForNavigation({ waitUntil: "load", timeout: 3e4 }).catch(() => {
    });
    if (page.url() === preUrl) {
      await page.click(btnSelector).catch(() => {
      });
      await page.waitForNavigation({ waitUntil: "load", timeout: 3e4 }).catch(() => {
      });
    }
    await bot.sendMessage(chatId, "\u{1F4F8} Next page (Page 8) loaded! Taking screenshot...");
    await page.waitForTimeout(3e3);
    const nextScreenshot = await page.screenshot({
      timeout: 3e4,
      animations: "disabled",
      type: "jpeg",
      quality: 40
    });
    await bot.sendPhoto(chatId, nextScreenshot, { caption: "\u2705 Next page reached! Here is the screen:" });
    await persistSessionState(chatId);
    clearTimeout(session.timeoutId);
    session.timeoutId = setTimeout(async () => {
      await bot.sendMessage(chatId, "\u23F3 Session expired due to 10 minutes of inactivity.");
      cleanupSession(chatId);
    }, 10 * 60 * 1e3);
  } catch (error) {
    await bot.sendMessage(chatId, `\u274C Error filling contact info:\\n${error.message}`);
  }
}

// server.ts
init_queue();
var import_express = __toESM(require("express"), 1);
var import_path7 = __toESM(require("path"), 1);
var import_fs8 = __toESM(require("fs"), 1);
var import_crypto6 = __toESM(require("crypto"), 1);
var TelegramBotModule = __toESM(require("node-telegram-bot-api"), 1);
var import_https_proxy_agent = require("https-proxy-agent");
var import_app = require("firebase/app");
var import_firestore = require("firebase/firestore");

// src/automation/handleSolicitarCita.ts
init_botContext();

// src/automation/handleAutoOfficeSelection.ts
init_botContext();
async function handleAutoOfficeSelection(chatId, fallbackUrl) {
  const session = activeSessions.get(chatId);
  if (!session) {
    await bot.sendMessage(chatId, "\u26A0\uFE0F Session expired. Please click 'Launch Cloud Browser' again.");
    return;
  }
  const { page } = session;
  await bot.sendMessage(chatId, "\u{1F504} Checking for Office Dropdown (#idSede)...");
  try {
    let officeSelectFound = false;
    let selectedOfficeName = null;
    for (let attempt = 0; attempt <= 2; attempt++) {
      selectedOfficeName = await page.evaluate(() => {
        const officeSelect = document.querySelector('select#idSede, select[name="idSede"]');
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
        break;
      }
      if (attempt < 2) {
        await bot.sendMessage(chatId, `\u26A0\uFE0F Dropdown not found. Reloading page (Attempt ${attempt + 1}/2)...`);
        await page.reload({ waitUntil: "load", timeout: 3e4 }).catch(() => {
        });
        await page.waitForTimeout(2500);
      }
    }
    if (officeSelectFound) {
      if (selectedOfficeName !== "EMPTY_BUT_EXISTS") {
        await bot.sendMessage(chatId, `\u2705 Randomly selected office: ${selectedOfficeName.trim()}. Adding human delay...`);
      }
      await page.waitForTimeout(Math.floor(Math.random() * 1500) + 1500);
      const preUrl3 = page.url();
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("input, button, a"));
        for (const btn of btns) {
          const txt = (btn.textContent || btn.value || "").toLowerCase();
          if (txt.includes("siguiente") || txt.includes("continuar")) {
            btn.click();
            return;
          }
        }
      });
      await page.waitForNavigation({ waitUntil: "load", timeout: 2e4 }).catch(() => {
      });
      if (page.url() === preUrl3) {
        await page.click('#btnSiguiente, input[value="Siguiente"], input[name="btnSiguiente"]').catch(() => {
        });
        await page.waitForNavigation({ waitUntil: "load", timeout: 2e4 }).catch(() => {
        });
      }
      await bot.sendMessage(chatId, "\u{1F4F8} Next page (Page 7) loaded! Taking screenshot...");
      await page.waitForTimeout(3e3);
      await bot.sendMessage(chatId, "\u2705 Office selected successfully. Reached Contact Info Page!", {
        reply_markup: {
          inline_keyboard: [[{ text: "\u{1F4DD} Fill Phone & Email", callback_data: "fill_contact" }]]
        }
      });
    } else {
      await bot.sendMessage(chatId, "\u{1F6A8} Dropdown missing after 2 reloads (Error/Clave). Executing FALLBACK logic to Saved URL...");
      await page.goto(fallbackUrl, { waitUntil: "domcontentloaded", timeout: 45e3 }).catch((e) => {
        console.error("Fallback error:", e);
      });
      await page.waitForTimeout(2e3);
      await bot.sendMessage(chatId, "\u{1F504} Fallback successful. Returned to the saved Form URL.");
      await bot.sendMessage(chatId, "\u{1F519} Returned to Form Page via Fallback.");
      await persistSessionState(chatId);
      return;
    }
    await persistSessionState(chatId);
    clearTimeout(session.timeoutId);
    session.timeoutId = setTimeout(async () => {
      await bot.sendMessage(chatId, "\u23F3 Session expired due to 10 minutes of inactivity.");
      cleanupSession(chatId);
    }, 10 * 60 * 1e3);
  } catch (e) {
    await bot.sendMessage(chatId, `\u26A0\uFE0F Error during Office Selection/Fallback: ${e.message}`);
  }
}

// src/automation/handleSolicitarCita.ts
async function handleSolicitarCita(chatId, fallbackUrl) {
  const session = activeSessions.get(chatId);
  if (!session) {
    await bot.sendMessage(chatId, "\u26A0\uFE0F Session expired. Please click 'Launch Cloud Browser' again.");
    return;
  }
  const { page } = session;
  await bot.sendMessage(chatId, "\u{1F504} Automatically clicking 'Solicitar Cita' to proceed to the next step...");
  try {
    const preUrl2 = page.url();
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("input, button, a"));
      for (const btn of btns) {
        const txt = (btn.textContent || btn.value || "").toLowerCase();
        if (txt.includes("solicitar cita")) {
          btn.click();
          return;
        }
      }
    });
    await page.waitForNavigation({ waitUntil: "load", timeout: 2e4 }).catch(() => {
    });
    if (page.url() === preUrl2) {
      await page.click('#btnEnviar, input[value="Solicitar Cita"], input[name="btnEnviar"]').catch(() => {
      });
      await page.waitForNavigation({ waitUntil: "load", timeout: 2e4 }).catch(() => {
      });
    }
    await bot.sendMessage(chatId, "\u{1F4F8} Next page (Page 6) loaded! Taking screenshot...");
    await page.waitForTimeout(3e3);
    await bot.sendMessage(chatId, "\u2705 'Solicitar Cita' clicked successfully. Here is the new page!");
    await handleAutoOfficeSelection(chatId, fallbackUrl);
  } catch (error) {
    await bot.sendMessage(chatId, `\u274C Error clicking Solicitar Cita:
${error.message}`);
  }
}

// src/automation/handleFormFill.ts
init_botContext();

// src/state.ts
var globalAutofillData = {
  phone: "0034634224788",
  email: "zeshuhere055@gmail.com",
  nie: "",
  name: ""
};

// src/automation/handleFormFill.ts
async function handleFormFill(chatId, queryId, nie, name) {
  const session = activeSessions.get(chatId);
  if (!session) {
    await bot.sendMessage(chatId, "\u26A0\uFE0F Session expired. Please click 'Launch Cloud Browser' again.");
    if (queryId) await bot.answerCallbackQuery(queryId).catch(() => {
    });
    return;
  }
  const { page } = session;
  const fallbackUrl = page.url();
  await bot.sendMessage(chatId, `\u{1F504} Autofilling form with NIE: ${nie} and Name: ${name}...`);
  if (queryId) await bot.answerCallbackQuery(queryId).catch(() => {
  });
  try {
    await page.evaluate((data) => {
      const setVal = (sel, val) => {
        const el = document.querySelector(sel);
        if (el && val) {
          el.value = val;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      };
      setVal("#txtIdCitado", data.nie);
      setVal("#txtDesCitado", data.name);
      setVal("#txtPaisNac", data.countryNac);
    }, { nie, name, countryNac: globalAutofillData.countryNac });
    await bot.sendMessage(chatId, "\u2705 Form data filled. Clicking 'Aceptar/Enviar' to proceed...");
    await page.waitForTimeout(1e3);
    const preUrl = page.url();
    const btnSelector = '#btnEnviar, #btnAceptar, input[value="Enviar"], input[value="Aceptar"]';
    await page.hover(btnSelector).catch(() => {
    });
    await page.waitForTimeout(Math.floor(Math.random() * 400) + 200);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "load", timeout: 45e3 }).catch(() => {
      }),
      page.click(btnSelector, { delay: Math.floor(Math.random() * 150) + 50 }).catch(() => {
      })
    ]);
    if (page.url() === preUrl) {
      await bot.sendMessage(chatId, "\u26A0\uFE0F URL didn't change via native click. Retrying via trusted event...");
      await Promise.all([
        page.waitForNavigation({ waitUntil: "load", timeout: 45e3 }).catch(() => {
        }),
        page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) {
            const evt = new MouseEvent("click", { view: window, bubbles: true, cancelable: true });
            el.dispatchEvent(evt);
          }
        }, btnSelector).catch(() => {
        })
      ]);
    }
    await page.waitForTimeout(3e3);
    await bot.sendMessage(chatId, "\u2705 Form submitted successfully. (Page 5)");
    await handleSolicitarCita(chatId, fallbackUrl);
  } catch (error) {
    await bot.sendMessage(chatId, `\u274C Error filling form:
${error.message}`);
  }
}

// src/handlers/launchBrowser.ts
var import_crypto = __toESM(require("crypto"), 1);
var import_path3 = __toESM(require("path"), 1);
var import_fs3 = __toESM(require("fs"), 1);
var import_playwright_extra = require("playwright-extra");
var import_puppeteer_extra_plugin_stealth = __toESM(require("puppeteer-extra-plugin-stealth"), 1);
init_botContext();

// src/handlers/handleCustomScript.ts
var import_fs2 = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_url2 = require("url");
init_botContext();

// src/handlers/scriptValidator.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_url = require("url");
async function validateScript(scriptPath) {
  try {
    if (!import_fs.default.existsSync(scriptPath)) {
      return { valid: false, error: "Script file not found" };
    }
    const stats = import_fs.default.statSync(scriptPath);
    const maxSize = 5 * 1024 * 1024;
    if (stats.size > maxSize) {
      return {
        valid: false,
        error: `Script too large (${Math.round(stats.size / 1024)}KB). Max: 5MB`
      };
    }
    const ext = import_path.default.extname(scriptPath).toLowerCase();
    if (![".js", ".mjs"].includes(ext)) {
      return { valid: false, error: "Script must be .js or .mjs file" };
    }
    const fileUrl = (0, import_url.pathToFileURL)(scriptPath).href;
    let module2;
    try {
      module2 = await import(fileUrl);
    } catch (syntaxError) {
      return {
        valid: false,
        error: `Script syntax error: ${syntaxError.message}`
      };
    }
    if (typeof module2.extract !== "function") {
      return {
        valid: false,
        error: "Script must export an 'extract' function: export async function extract(page) { ... }"
      };
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Validation error: ${err.message}` };
  }
}
function scanScriptContent(scriptPath) {
  const content = import_fs.default.readFileSync(scriptPath, "utf8");
  const warnings = [];
  const dangerousPatterns = [
    {
      pattern: /require\s*\(\s*['"]fs['"]\s*\)/,
      warning: "Script uses 'fs' module (file system access)"
    },
    {
      pattern: /require\s*\(\s*['"]child_process['"]\s*\)/,
      warning: "Script uses 'child_process' module"
    },
    {
      pattern: /process\.exit/,
      warning: "Script calls process.exit()"
    },
    {
      pattern: /eval\s*\(/,
      warning: "Script uses eval()"
    },
    {
      pattern: /import\s+.*\s+from\s+['"]fs['"]/,
      warning: "Script imports 'fs' module"
    },
    {
      pattern: /import\s+.*\s+from\s+['"]child_process['"]/,
      warning: "Script imports 'child_process' module"
    }
  ];
  for (const { pattern, warning } of dangerousPatterns) {
    if (pattern.test(content)) {
      warnings.push(warning);
    }
  }
  return { safe: warnings.length === 0, warnings };
}

// src/handlers/handleCustomScript.ts
var EXTRACTION_SCRIPTS_DIR = import_path2.default.resolve("./data/admin-extraction");
function ensureExtractionDir() {
  if (!import_fs2.default.existsSync(EXTRACTION_SCRIPTS_DIR)) {
    import_fs2.default.mkdirSync(EXTRACTION_SCRIPTS_DIR, { recursive: true });
  }
}
function getScriptPath(chatId) {
  const clientDir = import_path2.default.join(EXTRACTION_SCRIPTS_DIR, chatId.toString());
  if (!import_fs2.default.existsSync(clientDir)) {
    import_fs2.default.mkdirSync(clientDir, { recursive: true });
  }
  return import_path2.default.join(clientDir, "extraction.mjs");
}
function hasCustomScript(chatId) {
  const scriptPath = getScriptPath(chatId);
  return import_fs2.default.existsSync(scriptPath);
}
async function handleScriptUpload(chatId, fileName, fileBuffer) {
  console.log(`[ADMIN EXTRACTION] Admin ${chatId} uploaded script: ${fileName}`);
  try {
    ensureExtractionDir();
    const ext = import_path2.default.extname(fileName).toLowerCase();
    if (![".js", ".mjs"].includes(ext)) {
      await bot.sendMessage(
        chatId,
        "\u26A0\uFE0F Invalid file type. Please upload a `.js` or `.mjs` file.",
        { parse_mode: "Markdown" }
      );
      return;
    }
    const maxSize = 5 * 1024 * 1024;
    if (fileBuffer.length > maxSize) {
      await bot.sendMessage(
        chatId,
        `\u26A0\uFE0F File too large (${Math.round(fileBuffer.length / 1024)}KB). Maximum: 5MB`
      );
      return;
    }
    const scriptPath = getScriptPath(chatId);
    import_fs2.default.writeFileSync(scriptPath, fileBuffer);
    console.log(`[ADMIN EXTRACTION] Script stored at: ${scriptPath}`);
    await bot.sendMessage(chatId, "\u23F3 Validating extraction script...");
    const validation = await validateScript(scriptPath);
    if (!validation.valid) {
      console.log(`[ADMIN EXTRACTION] Validation failed: ${validation.error}`);
      import_fs2.default.unlinkSync(scriptPath);
      await bot.sendMessage(
        chatId,
        `\u274C Script validation failed:

${validation.error}

Please fix and upload again.`
      );
      return;
    }
    const scan = scanScriptContent(scriptPath);
    if (!scan.safe) {
      console.log(`[ADMIN EXTRACTION] Security warnings: ${scan.warnings.join(", ")}`);
      await bot.sendMessage(
        chatId,
        `\u26A0\uFE0F Security warnings detected:

${scan.warnings.map((w) => `\u2022 ${w}`).join("\n")}

Script saved but please review.`,
        { parse_mode: "Markdown" }
      );
    }
    console.log(`[ADMIN EXTRACTION] Script validated successfully`);
    await bot.sendMessage(
      chatId,
      `\u2705 Extraction script uploaded and validated!

File: \`${fileName}\`
Stored as: \`extraction.mjs\`

To use it:
1. Click "\u{1F4BE} Admin: Scrape Data (Launch Browser)"
2. After browser loads, click "\u{1F916} Run Custom Extraction"`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.error(`[ADMIN EXTRACTION] Upload error:`, err);
    await bot.sendMessage(
      chatId,
      `\u274C Error processing script: ${err.message}`
    );
  }
}
async function executeCustomScript(chatId) {
  console.log(`[ADMIN EXTRACTION] Executing custom script for admin ${chatId}`);
  try {
    if (!hasCustomScript(chatId)) {
      await bot.sendMessage(
        chatId,
        "\u26A0\uFE0F No custom extraction script found. Please upload one first."
      );
      return;
    }
    const session = activeSessions.get(chatId);
    if (!session || !session.page) {
      await bot.sendMessage(
        chatId,
        "\u26A0\uFE0F No active browser session. Please launch the browser first."
      );
      return;
    }
    const { page } = session;
    await bot.sendMessage(chatId, "\u{1F916} Loading custom extraction script...");
    const scriptPath = getScriptPath(chatId);
    const fileUrl = (0, import_url2.pathToFileURL)(scriptPath).href;
    const uniqueUrl = `${fileUrl}?t=${Date.now()}`;
    let module2;
    try {
      module2 = await import(uniqueUrl);
    } catch (importErr) {
      console.error(`[ADMIN EXTRACTION] Import error:`, importErr);
      await bot.sendMessage(
        chatId,
        `\u274C Failed to load script: ${importErr.message}`
      );
      return;
    }
    if (typeof module2.extract !== "function") {
      await bot.sendMessage(
        chatId,
        "\u274C Script does not export an 'extract' function."
      );
      return;
    }
    console.log(`[ADMIN EXTRACTION] Script loaded, executing extract(page)...`);
    await bot.sendMessage(chatId, "\u23F3 Running extraction logic...");
    const TIMEOUT = 12e4;
    let result;
    try {
      const extractionPromise = module2.extract(page);
      const timeoutPromise = new Promise(
        (_, reject) => setTimeout(() => reject(new Error("Extraction timeout (2 minutes)")), TIMEOUT)
      );
      result = await Promise.race([extractionPromise, timeoutPromise]);
    } catch (execErr) {
      console.error(`[ADMIN EXTRACTION] Execution error:`, execErr);
      await bot.sendMessage(
        chatId,
        `\u274C Extraction failed: ${execErr.message}`
      );
      return;
    }
    console.log(`[ADMIN EXTRACTION] Extraction completed successfully`);
    const resultText = typeof result === "object" ? JSON.stringify(result, null, 2) : String(result);
    if (resultText.length > 4e3) {
      const resultBuffer = Buffer.from(resultText, "utf8");
      await bot.sendDocument(chatId, resultBuffer, {
        caption: "\u2705 Custom extraction completed! Results attached."
      }, {
        filename: `extraction-result-${Date.now()}.json`
      });
    } else {
      await bot.sendMessage(
        chatId,
        `\u2705 Custom extraction completed!

\`\`\`json
${resultText}
\`\`\``,
        { parse_mode: "Markdown" }
      );
    }
    try {
      const screenshot = await page.screenshot({
        timeout: 15e3,
        type: "jpeg",
        quality: 40
      });
      await bot.sendPhoto(chatId, screenshot, {
        caption: "\u{1F4F8} Page state after extraction"
      });
    } catch (screenshotErr) {
      console.log("[ADMIN EXTRACTION] Screenshot failed (non-critical)");
    }
  } catch (err) {
    console.error(`[ADMIN EXTRACTION] Execution error:`, err);
    await bot.sendMessage(
      chatId,
      `\u274C Error during extraction: ${err.message}`
    );
  }
}

// src/handlers/launchBrowser.ts
import_playwright_extra.chromium.use((0, import_puppeteer_extra_plugin_stealth.default)());
async function handleLaunchBrowser(chatId, isRetry = false) {
  if (!isRetry) {
    await bot.sendMessage(chatId, "\u23F3 Launching Cloud Browser (Checking for existing session)...");
  } else {
    await bot.sendMessage(chatId, "\u267B\uFE0F IP/Session blocked! Auto-recovering: Deleted bad session, getting a fresh proxy...");
  }
  cleanupSession(chatId);
  let browser;
  try {
    const sessionStr = import_crypto.default.randomBytes(8).toString("hex");
    const randomPassword = `${PROXY_CONFIG.password}_session-${sessionStr}`;
    browser = await import_playwright_extra.chromium.launch({
      headless: true,
      ignoreDefaultArgs: ["--enable-automation"],
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1920,1080",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "--disable-features=IsolateOrigins,site-per-process"
      ],
      proxy: {
        server: PROXY_CONFIG.server,
        username: PROXY_CONFIG.username,
        password: randomPassword
      }
    });
    const sessionFilePath = import_path3.default.resolve(`./sessions/${chatId}.json`);
    const contextOptions = {
      locale: "es-ES",
      timezoneId: "Europe/Madrid",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      extraHTTPHeaders: {
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
      }
    };
    let usingOldSession = false;
    if (!isRetry && import_fs3.default.existsSync(sessionFilePath)) {
      contextOptions.storageState = sessionFilePath;
      usingOldSession = true;
    }
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false
      });
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => parameters.name === "notifications" ? Promise.resolve({ state: "denied" }) : originalQuery(parameters);
      window.chrome = {
        runtime: {},
        loadTimes: function() {
        },
        csi: function() {
        },
        app: {}
      };
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5]
      });
      Object.defineProperty(navigator, "languages", {
        get: () => ["es-ES", "es", "en-US", "en"]
      });
    });
    if (!isRetry) await bot.sendMessage(chatId, "\u{1F310} Browser opened! Navigating to Extranjer\xEDa...");
    try {
      await page.goto("https://sede.administracionespublicas.gob.es/pagina/index/directorio/icpplus", {
        waitUntil: "domcontentloaded",
        timeout: 12e4
      });
      await bot.sendMessage(chatId, "\u23F3 Waiting for page to fully load (anti-bot checks)...");
      await page.waitForTimeout(5e3);
    } catch (e) {
      if (e.message.includes("ERR_TUNNEL_CONNECTION_FAILED")) {
        await bot.sendMessage(chatId, "\u26A0\uFE0F Proxy error detected (ERR_TUNNEL_CONNECTION_FAILED). Trying to reconnect with a different node in 5 seconds...");
        await page.waitForTimeout(5e3);
        await page.goto("https://sede.administracionespublicas.gob.es/pagina/index/directorio/icpplus", {
          waitUntil: "domcontentloaded",
          timeout: 12e4
        });
        await page.waitForTimeout(5e3);
      } else {
        throw e;
      }
    }
    const pageText = await page.evaluate(() => document.body.innerText || "");
    const currentUrl = page.url();
    if (currentUrl.includes("/icpplus/index.html") || pageText.includes("window.SpaB")) {
      await bot.sendMessage(chatId, "\u{1F916} Bot detection page detected. Waiting for redirect...");
      console.log("[LAUNCH] Bot detection page detected, waiting 10 seconds...");
      await page.waitForTimeout(1e4);
      const urlAfterWait = page.url();
      if (urlAfterWait.includes("/icpplus/index.html")) {
        await bot.sendMessage(chatId, "\u26A0\uFE0F Still on bot detection page. Trying to navigate manually...");
        console.log("[LAUNCH] Still on bot page, manually navigating to form page...");
        try {
          await page.goto("https://icp.administracionelectronica.gob.es/icpplus/citar", {
            waitUntil: "domcontentloaded",
            timeout: 6e4
          });
          await page.waitForTimeout(3e3);
        } catch (navError) {
          console.log("[LAUNCH] Direct navigation failed:", navError.message);
        }
      }
    }
    if (pageText.includes("vuelva a intentarlo m\xE1s tarde") || pageText.includes("ERROR [503]") || pageText.includes("Forbidden")) {
      if (usingOldSession) {
        if (import_fs3.default.existsSync(sessionFilePath)) import_fs3.default.unlinkSync(sessionFilePath);
        await browser.close().catch(() => {
        });
        return handleLaunchBrowser(chatId, true);
      } else {
        throw new Error("WAF 503 Error Hit even on a fresh IP. Please wait a bit and try again.");
      }
    }
    try {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button, a, input"));
        for (const btn of btns) {
          const txt = (btn.textContent || btn.value || "").toLowerCase();
          if (txt.includes("aceptar cookie") || txt.includes("entendido")) {
            btn.click();
          }
        }
      });
      await page.waitForTimeout(1e3);
    } catch (e) {
    }
    await bot.sendMessage(chatId, "\u{1F449} Checking if '#submit' button exists...");
    try {
      const buttonElement = await page.$("#submit");
      if (buttonElement) {
        await bot.sendMessage(chatId, "\u{1F449} Button found! Adding human delay before clicking...");
        await page.waitForTimeout(Math.floor(Math.random() * 1500) + 2e3);
        await Promise.all([
          page.waitForNavigation({ waitUntil: "load", timeout: 45e3 }).catch(() => {
          }),
          page.click("#submit", { delay: Math.floor(Math.random() * 100) + 50 }).catch(() => {
          })
        ]);
        const postSubmitText = await page.evaluate(() => document.body.innerText || "");
        if (postSubmitText.includes("Forbidden") || postSubmitText.includes("vuelva a intentarlo") || postSubmitText.includes("ERROR [503]")) {
          if (true) {
            if (import_fs3.default.existsSync(sessionFilePath)) import_fs3.default.unlinkSync(sessionFilePath);
            await browser.close().catch(() => {
            });
            return handleLaunchBrowser(chatId, true);
          } else {
            throw new Error("WAF 403/503 Error Hit even on a fresh IP after submit. Please wait a bit and try again.");
          }
        }
      }
    } catch (err) {
    }
    await bot.sendMessage(chatId, "\u23F3 Waiting for province dropdown...");
    try {
      await page.waitForSelector("select#form", { timeout: 3e4 });
    } catch (e) {
      const isForbidden = await page.evaluate(() => document.body && document.body.innerText.includes("Forbidden"));
      if (isForbidden) {
        if (usingOldSession) {
          if (import_fs3.default.existsSync(sessionFilePath)) import_fs3.default.unlinkSync(sessionFilePath);
          await browser.close().catch(() => {
          });
          return handleLaunchBrowser(chatId, true);
        } else {
          throw new Error("WAF 403 Forbidden Error Hit on a fresh IP. IP is blocked.");
        }
      }
      const currentUrl2 = await page.url();
      const bodyHtml = await page.evaluate(() => document.body.outerHTML.substring(0, 500));
      await bot.sendMessage(chatId, "\u26A0\uFE0F Could not find province dropdown.\nURL: " + currentUrl2 + "\nBody: " + bodyHtml + "\nTaking debug screenshot...");
      try {
        const errImg = await page.screenshot({ timeout: 15e3, type: "jpeg", quality: 40 });
        await bot.sendPhoto(chatId, errImg, { caption: "Timeout state." });
      } catch (err) {
      }
      throw new Error("Timeout waiting for province dropdown.");
    }
    await bot.sendMessage(chatId, "\u{1F50D} Extracting page data...");
    const provinces = await page.$$eval("select#form option", (options) => {
      return options.map((o) => ({ text: o.textContent?.trim() || "", value: o.value })).filter((o) => o.value !== "" && !o.text.includes("Seleccione"));
    });
    if (provinces && provinces.length > 0) {
      try {
        const dbPath = import_path3.default.resolve("./fastmode_db.json");
        let db2 = { provinces: [], offices: {}, tramites: {} };
        if (import_fs3.default.existsSync(dbPath)) {
          try {
            db2 = JSON.parse(import_fs3.default.readFileSync(dbPath, "utf8"));
          } catch (e) {
          }
        }
        db2.provinces = provinces;
        import_fs3.default.writeFileSync(dbPath, JSON.stringify(db2, null, 2));
      } catch (e) {
        console.error("Failed to save provinces to fast DB", e);
      }
      await bot.sendMessage(chatId, `\u2705 Found ${provinces.length} provinces. (Saved to Database)`);
      await bot.sendMessage(chatId, "\u{1F4CD} Province page loaded successfully!");
      const inlineKeyboard = [];
      for (let i = 0; i < provinces.length; i += 4) {
        const row = [];
        for (let j = 0; j < 4; j++) {
          if (provinces[i + j]) row.push({ text: provinces[i + j].text, callback_data: `prov_${i + j}` });
        }
        inlineKeyboard.push(row);
      }
      if (hasCustomScript(chatId)) {
        inlineKeyboard.push([{ text: "\u{1F916} Run Custom Extraction", callback_data: "run_custom_extraction" }]);
      }
      inlineKeyboard.push([{ text: "\u{1F6D1} Close Browser (Save MBs)", callback_data: "close_browser" }]);
      await bot.sendMessage(chatId, "\u{1F4CD} Please select a province (or close browser to save MBs):", { reply_markup: { inline_keyboard: inlineKeyboard } });
      const timeoutId = setTimeout(async () => {
        await bot.sendMessage(chatId, "\u23F3 Session expired due to 10 minutes of inactivity.");
        cleanupSession(chatId);
      }, 10 * 60 * 1e3);
      activeSessions.set(chatId, { browser, context, page, timeoutId, provinces });
      await persistSessionState(chatId);
    } else {
      throw new Error("No provinces found on the page.");
    }
  } catch (err) {
    await bot.sendMessage(chatId, `\u274C Error: ${err.message}`);
    if (browser) {
      browser.close().catch(() => {
      });
    }
  }
}

// src/automation/handleProvinceSelection.ts
init_botContext();
var import_path4 = __toESM(require("path"), 1);
var import_fs4 = __toESM(require("fs"), 1);
async function handleProvinceSelection(chatId, queryId, index) {
  const session = activeSessions.get(chatId);
  if (!session) {
    await bot.sendMessage(chatId, "\u26A0\uFE0F Session expired. Please click 'Launch Cloud Browser' again.");
    if (queryId) await bot.answerCallbackQuery(queryId).catch(() => {
    });
    return;
  }
  const { page, provinces } = session;
  const selectedProv = provinces?.[index];
  if (!selectedProv) {
    await bot.sendMessage(chatId, "\u26A0\uFE0F Invalid province selection.");
    if (queryId) await bot.answerCallbackQuery(queryId).catch(() => {
    });
    return;
  }
  if (!userStates.has(chatId)) userStates.set(chatId, {});
  userStates.get(chatId).province = selectedProv;
  await bot.sendMessage(chatId, `\u{1F504} Selecting province: ${selectedProv.text}...`);
  if (queryId) await bot.answerCallbackQuery(queryId).catch(() => {
  });
  try {
    try {
      await page.selectOption("select#form", selectedProv.value);
    } catch (e) {
    }
    try {
      await page.evaluate(() => {
        const selectElement = document.querySelector("select#form");
        if (selectElement) {
          selectElement.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    } catch (e) {
    }
    await page.waitForTimeout(2e3);
    await bot.sendMessage(chatId, `\u2705 Province selected. Clicking 'Aceptar'...`);
    try {
      const preUrl = page.url();
      const btnSelector = '#btnAceptar, input[value="Aceptar"]';
      await page.evaluate(() => {
        const overlays = document.querySelectorAll('[id*="cookie"], [class*="cookie"], [id*="aviso"], [class*="aviso"]');
        overlays.forEach((o) => {
          o.style.display = "none";
        });
      }).catch(() => {
      });
      await page.waitForTimeout(Math.floor(Math.random() * 1500) + 1e3);
      await page.mouse.move(Math.floor(Math.random() * 800), Math.floor(Math.random() * 600), { steps: 5 }).catch(() => {
      });
      await page.waitForTimeout(Math.floor(Math.random() * 500) + 200);
      await page.mouse.wheel(0, Math.floor(Math.random() * 300) + 100).catch(() => {
      });
      await page.waitForTimeout(Math.floor(Math.random() * 800) + 500);
      await page.hover(btnSelector).catch(() => {
      });
      await page.waitForTimeout(Math.floor(Math.random() * 600) + 300);
      await Promise.all([
        page.waitForNavigation({ waitUntil: "load", timeout: 45e3 }).catch(() => {
        }),
        page.click(btnSelector, { delay: Math.floor(Math.random() * 200) + 80 }).catch(() => {
        })
      ]);
      if (page.url() === preUrl) {
        await bot.sendMessage(chatId, "\u26A0\uFE0F Retrying via trusted event...");
        await Promise.all([
          page.waitForNavigation({ waitUntil: "load", timeout: 45e3 }).catch(() => {
          }),
          page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) {
              const evt = new MouseEvent("click", { view: window, bubbles: true, cancelable: true });
              el.dispatchEvent(evt);
            }
          }, btnSelector).catch(() => {
          })
        ]);
      }
    } catch (clickErr) {
      await bot.sendMessage(chatId, `\u26A0\uFE0F Navigation error: ${clickErr.message}`);
    }
    await bot.sendMessage(chatId, "\u23F3 Waiting 10 seconds for the next page to fully render via proxy...");
    await page.waitForTimeout(1e4);
    const pageText = await page.evaluate(() => document.body.innerText || "");
    if (pageText.includes("The requested URL was rejected") || pageText.includes("Please consult with your administrator")) {
      await bot.sendMessage(chatId, "\u{1F6A8} WAF Block Detected! Extranjer\xEDa's firewall (F5/Cloudflare) blocked the request. This usually happens if clicks are too robotic or the proxy IP is flagged.\n\nClosing browser to prevent permanent IP ban.");
      cleanupSession(chatId);
      return;
    }
    await bot.sendMessage(chatId, "\u23F3 Extracting Offices and Tr\xE1mites...");
    let offices = [];
    try {
      offices = await page.$$eval("select", (selects) => {
        let targetSelect = selects.find((s) => s.id.toLowerCase().includes("sede") || s.name.toLowerCase().includes("sede"));
        if (!targetSelect) {
          targetSelect = selects.find((s) => Array.from(s.options).some((o) => o.text.toLowerCase().includes("oficina")));
        }
        if (targetSelect) {
          return Array.from(targetSelect.options).map((o) => ({ text: o.textContent?.trim() || "", value: o.value, selectId: targetSelect.id, selectName: targetSelect.name })).filter((o) => o.value !== "" && !o.text.includes("Seleccione"));
        }
        return [];
      });
    } catch (e) {
    }
    let tramites = [];
    try {
      tramites = await page.$$eval("select", (selects) => {
        let targetSelects = selects.filter((s) => s.id.toLowerCase().includes("tramite") || s.name.toLowerCase().includes("tramite"));
        let allOptions = [];
        for (const select of targetSelects) {
          for (const option of select.options) {
            if (option.value !== "" && option.value !== "-1" && !option.text.toLowerCase().includes("despliega para ver")) {
              allOptions.push({
                text: option.textContent?.trim() || "",
                value: option.value,
                selectId: select.id,
                selectName: select.name
              });
            }
          }
        }
        return allOptions;
      });
    } catch (e) {
    }
    const screenshotBuffer = await page.screenshot({ timeout: 3e4, animations: "disabled", type: "jpeg", quality: 40 });
    try {
      const dbPath = import_path4.default.resolve("./fastmode_db.json");
      let db2 = { provinces: [], offices: {}, tramites: {} };
      if (import_fs4.default.existsSync(dbPath)) {
        try {
          db2 = JSON.parse(import_fs4.default.readFileSync(dbPath, "utf8"));
        } catch (e) {
        }
      }
      if (offices && offices.length > 0) db2.offices[selectedProv.value] = offices;
      if (tramites && tramites.length > 0) db2.tramites[selectedProv.value] = tramites;
      import_fs4.default.writeFileSync(dbPath, JSON.stringify(db2, null, 2));
    } catch (e) {
      console.error("Failed to save offices/tramites to fast DB", e);
    }
    if (offices.length > 0) {
      session.offices = offices;
      session.tramites = tramites;
      await bot.sendMessage(chatId, `\u2705 Found ${offices.length} offices and ${tramites.length} tr\xE1mites. (Saved to Database for ${selectedProv.text})`);
      const inlineKeyboard = [];
      for (let i = 0; i < offices.length; i++) {
        let buttonText = offices[i].text;
        if (buttonText.length > 60) buttonText = buttonText.substring(0, 57) + "...";
        inlineKeyboard.push([{ text: buttonText, callback_data: `office_${i}` }]);
      }
      inlineKeyboard.push([{ text: "\u{1F6D1} Close Browser (Save MBs)", callback_data: "close_browser" }]);
      await bot.sendMessage(chatId, `\u2705 Selected Province: ${selectedProv.text}

\u{1F3E2} Please select an Office:`, { reply_markup: { inline_keyboard: inlineKeyboard } });
    } else if (tramites.length > 0) {
      session.tramites = tramites;
      await bot.sendMessage(chatId, `\u2705 Found 0 offices, but ${tramites.length} tr\xE1mites. (Saved to Database for ${selectedProv.text})`);
      const inlineKeyboard = [];
      for (let i = 0; i < tramites.length; i++) {
        let buttonText = tramites[i].text;
        if (buttonText.length > 60) buttonText = buttonText.substring(0, 57) + "...";
        inlineKeyboard.push([{ text: buttonText, callback_data: `tramite_${i}` }]);
      }
      inlineKeyboard.push([{ text: "\u{1F6D1} Close Browser (Save MBs)", callback_data: "close_browser" }]);
      await bot.sendMessage(chatId, `\u2705 Selected Province: ${selectedProv.text}

\u{1F4C4} No specific office dropdown. Please select a Tr\xE1mite:`, { reply_markup: { inline_keyboard: inlineKeyboard } });
    } else {
      await bot.sendPhoto(chatId, screenshotBuffer, { caption: `\u2705 Selected Province: ${selectedProv.text}
\u26A0\uFE0F No offices or tr\xE1mites found on this page. The layout might be different.` });
    }
    await persistSessionState(chatId);
    clearTimeout(session.timeoutId);
    session.timeoutId = setTimeout(async () => {
      await bot.sendMessage(chatId, "\u23F3 Session expired due to 10 minutes of inactivity.");
      cleanupSession(chatId);
    }, 10 * 60 * 1e3);
  } catch (error) {
    await bot.sendMessage(chatId, `\u274C Error moving to next step:
${error.message}

\u{1F4F8} Taking debug screenshot...`);
    try {
      const errImg = await page.screenshot({ timeout: 15e3, type: "jpeg", quality: 40 });
      await bot.sendPhoto(chatId, errImg, { caption: "Debug screenshot of the error state." });
    } catch (e) {
    }
  }
}

// src/automation/handleOfficeSelection.ts
init_botContext();
async function handleOfficeSelection(chatId, queryId, index) {
  const session = activeSessions.get(chatId);
  if (!session) {
    await bot.sendMessage(chatId, "\u26A0\uFE0F Session expired. Please click 'Launch Cloud Browser' again.");
    await bot.answerCallbackQuery(queryId);
    return;
  }
  const { page, offices } = session;
  const selectedOffice = offices?.[index];
  if (!selectedOffice) {
    await bot.sendMessage(chatId, "\u26A0\uFE0F Invalid office selection.");
    await bot.answerCallbackQuery(queryId);
    return;
  }
  if (!userStates.has(chatId)) userStates.set(chatId, {});
  userStates.get(chatId).office = selectedOffice;
  await bot.sendMessage(chatId, `\u{1F504} Selecting office: ${selectedOffice.text}...`);
  await bot.answerCallbackQuery(queryId);
  try {
    try {
      if (selectedOffice.selectId) {
        await page.selectOption(`select[id="${selectedOffice.selectId}"]`, selectedOffice.value).catch(() => {
        });
      } else if (selectedOffice.selectName) {
        await page.selectOption(`select[name="${selectedOffice.selectName}"]`, selectedOffice.value).catch(() => {
        });
      } else {
        await page.selectOption("select#sede", selectedOffice.value).catch(() => {
        });
      }
    } catch (e) {
    }
    try {
      await page.evaluate((val) => {
        const selects = Array.from(document.querySelectorAll("select"));
        let targetSelect = selects.find((s) => s.id.toLowerCase().includes("sede") || s.name.toLowerCase().includes("sede"));
        if (!targetSelect) {
          targetSelect = selects.find((s) => Array.from(s.options).some((o) => o.text.toLowerCase().includes("oficina")));
        }
        if (targetSelect) {
          targetSelect.value = val;
          targetSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }, selectedOffice.value);
    } catch (e) {
    }
    await bot.sendMessage(chatId, `\u2705 Office selected.`);
    await page.waitForTimeout(2e3);
    await bot.sendMessage(chatId, "\u{1F50D} Extracting available 'Tr\xE1mites'...");
    let tramites = [];
    try {
      await page.waitForFunction(() => {
        const selects = Array.from(document.querySelectorAll("select"));
        return selects.some((s) => s.id.toLowerCase().includes("tramite") || s.name.toLowerCase().includes("tramite"));
      }, { timeout: 15e3 }).catch(() => {
      });
      tramites = await page.$$eval("select", (selects) => {
        let targetSelects = selects.filter((s) => s.id.toLowerCase().includes("tramite") || s.name.toLowerCase().includes("tramite"));
        let allOptions = [];
        for (const select of targetSelects) {
          for (const option of select.options) {
            if (option.value !== "" && option.value !== "-1" && !option.text.toLowerCase().includes("despliega para ver")) {
              allOptions.push({
                text: option.textContent?.trim() || "",
                value: option.value,
                selectId: select.id,
                selectName: select.name
              });
            }
          }
        }
        return allOptions;
      });
    } catch (e) {
      await bot.sendMessage(chatId, `\u26A0\uFE0F Could not locate the Tr\xE1mites dropdown. The site might require a different step.
Error: ${e.message}`);
    }
    await bot.sendMessage(chatId, "\u{1F4F8} Taking screenshot of the updated form...");
    const screenshotBuffer = await page.screenshot({
      timeout: 3e4,
      animations: "disabled",
      type: "jpeg",
      quality: 40
    });
    if (tramites.length > 0) {
      session.tramites = tramites;
      try {
        const provVal = userStates.get(chatId)?.province?.value;
        if (provVal) {
          const dbPath = path.resolve("./fastmode_db.json");
          let db2 = { provinces: [], offices: {}, tramites: {} };
          if (fs.existsSync(dbPath)) {
            try {
              db2 = JSON.parse(fs.readFileSync(dbPath, "utf8"));
            } catch (e) {
            }
          }
          db2.tramites[provVal] = tramites;
          fs.writeFileSync(dbPath, JSON.stringify(db2, null, 2));
        }
      } catch (e) {
        console.error("Failed to save tramites to fast DB", e);
      }
      await bot.sendMessage(chatId, `\u2705 Found ${tramites.length} Tr\xE1mites.`);
      const inlineKeyboard = [];
      for (let i = 0; i < tramites.length; i++) {
        let buttonText = tramites[i].text;
        if (buttonText.length > 60) buttonText = buttonText.substring(0, 57) + "...";
        inlineKeyboard.push([{ text: buttonText, callback_data: `tramite_${i}` }]);
      }
      await bot.sendMessage(chatId, `\u2705 Selected Office: ${selectedOffice.text}

\u{1F4C4} Please select a Tr\xE1mite:`, { reply_markup: { inline_keyboard: inlineKeyboard } });
    } else {
      await bot.sendMessage(chatId, `\u2705 Selected Office: ${selectedOffice.text}
\u26A0\uFE0F No Tr\xE1mites found in the dropdown. Please let me know the next step.`);
    }
    await persistSessionState(chatId);
    clearTimeout(session.timeoutId);
    session.timeoutId = setTimeout(async () => {
      await bot.sendMessage(chatId, "\u23F3 Session expired due to 10 minutes of inactivity.");
      cleanupSession(chatId);
    }, 10 * 60 * 1e3);
  } catch (error) {
    await bot.sendMessage(chatId, `\u274C Error selecting office:
${error.message}

\u{1F4F8} Taking debug screenshot...`);
    try {
      const errImg = await page.screenshot({ timeout: 15e3, type: "jpeg", quality: 40 });
      await bot.sendPhoto(chatId, errImg, { caption: "Debug screenshot of the error state." });
    } catch (e) {
    }
  }
}

// src/automation/handleTramiteSelection.ts
init_botContext();
async function handleTramiteSelection(chatId, queryId, index) {
  const session = activeSessions.get(chatId);
  if (!session) {
    await bot.sendMessage(chatId, "\u26A0\uFE0F Session expired. Please click 'Launch Cloud Browser' again.");
    await bot.answerCallbackQuery(queryId);
    return;
  }
  const { page, tramites } = session;
  const selectedTramite = tramites?.[index];
  if (!selectedTramite) {
    await bot.sendMessage(chatId, "\u26A0\uFE0F Invalid Tr\xE1mite selection.");
    await bot.answerCallbackQuery(queryId);
    return;
  }
  if (!userStates.has(chatId)) userStates.set(chatId, {});
  userStates.get(chatId).tramite = selectedTramite;
  await bot.sendMessage(chatId, `\u{1F504} Selecting Tr\xE1mite: ${selectedTramite.text}...`);
  await bot.answerCallbackQuery(queryId);
  try {
    try {
      if (selectedTramite.selectId) {
        await page.selectOption(`select[id="${selectedTramite.selectId}"]`, selectedTramite.value).catch(() => {
        });
      } else if (selectedTramite.selectName) {
        await page.selectOption(`select[name="${selectedTramite.selectName}"]`, selectedTramite.value).catch(() => {
        });
      }
    } catch (e) {
    }
    try {
      await page.evaluate((val) => {
        const selects = Array.from(document.querySelectorAll("select")).filter((s) => s.id.toLowerCase().includes("tramite") || s.name.toLowerCase().includes("tramite"));
        selects.forEach((s) => {
          const selectElem = s;
          for (const opt of Array.from(selectElem.options)) {
            if (opt.value === val) {
              selectElem.value = val;
              selectElem.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
        });
      }, selectedTramite.value);
    } catch (e) {
    }
    await page.waitForTimeout(2e3);
    await bot.sendMessage(chatId, `\u2705 Tr\xE1mite selected. Clicking 'Aceptar'...`);
    try {
      const preUrl = page.url();
      const btnSelector = '#btnAceptar, input[value="Aceptar"]';
      await page.evaluate(() => {
        const overlays = document.querySelectorAll('[id*="cookie"], [class*="cookie"], [id*="aviso"], [class*="aviso"]');
        overlays.forEach((o) => {
          o.style.display = "none";
        });
      }).catch(() => {
      });
      await page.waitForTimeout(Math.floor(Math.random() * 2e3) + 1500);
      await page.hover(btnSelector).catch(() => {
      });
      await page.waitForTimeout(Math.floor(Math.random() * 400) + 200);
      await Promise.all([
        page.waitForNavigation({ waitUntil: "load", timeout: 45e3 }).catch(() => {
        }),
        page.click(btnSelector, { delay: Math.floor(Math.random() * 150) + 50 }).catch(() => {
        })
      ]);
      if (page.url() === preUrl) {
        await bot.sendMessage(chatId, "\u26A0\uFE0F URL didn't change native click. Retrying via trusted event...");
        await Promise.all([
          page.waitForNavigation({ waitUntil: "load", timeout: 45e3 }).catch(() => {
          }),
          page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) {
              const evt = new MouseEvent("click", { view: window, bubbles: true, cancelable: true });
              el.dispatchEvent(evt);
            }
          }, btnSelector).catch(() => {
          })
        ]);
      }
    } catch (clickErr) {
      await bot.sendMessage(chatId, `\u26A0\uFE0F Navigation error: ${clickErr.message}`);
    }
    await bot.sendMessage(chatId, "\u23F3 Waiting 8 seconds for the next page to fully render via proxy...");
    await page.waitForTimeout(8e3);
    await bot.sendMessage(chatId, "\u{1F50D} Scraping available actions/buttons on this page (like Cl@ve, Entrar, etc.)...");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1e3);
    const dynamicButtons = await page.evaluate(() => {
      const foundBtns = [];
      const buttonTargets = [
        { id: "btnEntrar", label: "Entrar (Sin Cl@ve)", selectors: ["#btnEntrar", 'input[value="Entrar"]', 'input[name="btnEntrar"]'] },
        { id: "btnClave", label: "Acceder con Cl@ve", selectors: ["#btnAccesoClave", "#btnEnviarClave", 'input[value*="Cl@ve"]', 'input[value*="Clave"]', 'input[name*="clave"]', 'img[alt*="Cl@ve"]', 'a[href*="clave"]', 'button[title*="Cl@ve"]', 'button[id*="clave"]', ".botonClave", "#clave"] },
        { id: "btnAceptar", label: "Aceptar", selectors: ["#btnAceptar", 'input[value="Aceptar"]'] },
        { id: "btnSiguiente", label: "Siguiente / Continuar", selectors: ["#btnSiguiente", 'input[value="Siguiente"]', 'input[value="Continuar"]'] }
      ];
      let idx = 0;
      for (const target of buttonTargets) {
        let foundForTarget = false;
        for (const sel of target.selectors) {
          const elements = document.querySelectorAll(sel);
          if (elements.length > 0) {
            for (const el of Array.from(elements)) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                let finalSelector = sel;
                if (el.id) {
                  finalSelector = "#" + el.id;
                } else if (el.name) {
                  finalSelector = el.tagName.toLowerCase() + '[name="' + el.name + '"]';
                } else {
                  el.setAttribute("data-bot-id", "fastbtn-" + idx);
                  finalSelector = '[data-bot-id="fastbtn-' + idx + '"]';
                }
                foundBtns.push({
                  text: target.label,
                  selector: finalSelector,
                  index: idx
                });
                idx++;
                foundForTarget = true;
                break;
              }
            }
            if (foundForTarget) break;
          }
        }
      }
      const claveAlreadyFound = foundBtns.some((b) => b.text.includes("Cl@ve"));
      if (!claveAlreadyFound) {
        const allElements = document.querySelectorAll('img, button, input[type="image"], a');
        for (const el of Array.from(allElements)) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const text = (el.alt || el.title || el.src || el.href || el.innerText || el.value || "").toLowerCase();
            if (text.includes("cl@ve") || text.includes("clave")) {
              let finalSelector = "";
              if (el.id) {
                finalSelector = "#" + el.id;
              } else {
                el.setAttribute("data-bot-id", "fastbtn-fallback-" + idx);
                finalSelector = '[data-bot-id="fastbtn-fallback-' + idx + '"]';
              }
              foundBtns.push({
                text: "Acceder con Cl@ve (Found via Scan)",
                selector: finalSelector,
                index: idx
              });
              idx++;
              break;
            }
          }
        }
      }
      return foundBtns;
    });
    console.log("[TRAMITE] Buttons found on page:", dynamicButtons.length);
    if (dynamicButtons.length > 0) {
      console.log("[TRAMITE] Button details:", dynamicButtons.map((b) => `${b.text} (selector: ${b.selector})`).join(", "));
    } else {
      console.log("[TRAMITE] NO BUTTONS FOUND! Page URL:", page.url());
      const pageText = await page.evaluate(() => document.body.innerText.substring(0, 500));
      console.log("[TRAMITE] Page text preview:", pageText);
    }
    const claveButtonFound = dynamicButtons.some((b) => b.text.includes("Cl@ve"));
    if (!claveButtonFound) {
      console.log("[TRAMITE] WARNING: Acceder con Cl@ve button NOT FOUND on this page!");
      console.log("[TRAMITE] This tr\xE1mite may not support Cl@ve authentication.");
      console.log("[TRAMITE] Available buttons:", dynamicButtons.map((b) => b.text).join(", "));
      await bot.sendMessage(
        chatId,
        "\u26A0\uFE0F Warning: 'Acceder con Cl@ve' button not found on this page.\n\nThis tr\xE1mite may not support Cl@ve certificate authentication.\n\nAvailable options: " + dynamicButtons.map((b) => b.text).join(", ")
      );
      const pageFullText = await page.evaluate(() => document.body.innerText);
      const hasClaveMention = pageFullText.toLowerCase().includes("clave") || pageFullText.toLowerCase().includes("cl@ve");
      console.log('[TRAMITE] Page mentions "clave":', hasClaveMention);
    }
    await bot.sendMessage(chatId, `\u{1F50D} Found ${dynamicButtons.length} button(s) on this page.`);
    session.dynamicButtons = dynamicButtons;
    await bot.sendMessage(chatId, "\u{1F4F8} Next page loaded. Taking screenshot...");
    const screenshotBuffer = await page.screenshot({
      timeout: 3e4,
      animations: "disabled",
      type: "jpeg",
      quality: 40
    });
    const inline_keyboard = [];
    if (dynamicButtons && dynamicButtons.length > 0) {
      dynamicButtons.forEach((btn) => {
        inline_keyboard.push([{ text: "\u{1F5B1}\uFE0F " + btn.text, callback_data: "dyn_" + btn.index }]);
      });
    }
    inline_keyboard.push([{ text: "\u{1F4DD} Autofill Form (NIE/Name) [Fallback]", callback_data: "autofill_form" }]);
    await bot.sendPhoto(chatId, screenshotBuffer, {
      caption: `\u2705 Selected Tr\xE1mite: ${selectedTramite.text}
Here is the intermediate page. Please select the next action (e.g. Cl@ve, Entrar):`,
      reply_markup: { inline_keyboard }
    });
    await persistSessionState(chatId);
    clearTimeout(session.timeoutId);
    session.timeoutId = setTimeout(async () => {
      await bot.sendMessage(chatId, "\u23F3 Session expired due to 10 minutes of inactivity.");
      cleanupSession(chatId);
    }, 10 * 60 * 1e3);
    return;
  } catch (error) {
    await bot.sendMessage(chatId, `\u274C Error moving to next step:
${error.message}

\u{1F4F8} Taking debug screenshot...`);
    try {
      const errImg = await page.screenshot({ timeout: 15e3, type: "jpeg", quality: 40 });
      await bot.sendPhoto(chatId, errImg, { caption: "Debug screenshot of the error state." });
    } catch (e) {
    }
  }
}

// server.ts
init_botContext();
init_handleClaveAuth();
var import_playwright_extra4 = require("playwright-extra");
var import_puppeteer_extra_plugin_stealth4 = __toESM(require("puppeteer-extra-plugin-stealth"), 1);
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});
process.on("uncaughtException", (err) => {
  console.error("CRITICAL: Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("CRITICAL: Unhandled Rejection at:", promise, "reason:", reason);
});
var EXTERNAL_URL = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
setInterval(() => {
  console.log("[Heartbeat] Keeping bot awake...", (/* @__PURE__ */ new Date()).toISOString());
  if (EXTERNAL_URL) {
    fetch(EXTERNAL_URL + "/api/health").catch((e) => console.log("Self-ping failed:", e.message));
  }
}, 5 * 60 * 1e3);
import_playwright_extra4.chromium.use((0, import_puppeteer_extra_plugin_stealth4.default)());
var userStates2 = /* @__PURE__ */ new Map();
var autofillState = /* @__PURE__ */ new Map();
var contactInfoState = /* @__PURE__ */ new Map();
var sessionsDir = import_path7.default.resolve("./sessions");
if (!import_fs8.default.existsSync(sessionsDir)) {
  import_fs8.default.mkdirSync(sessionsDir, { recursive: true });
}
var activeSessions2 = /* @__PURE__ */ new Map();
async function persistSessionState4(chatId) {
  const session = activeSessions2.get(chatId);
  if (session && session.context) {
    try {
      const sessionFilePath = import_path7.default.resolve(`./sessions/${chatId}.json`);
      await session.context.storageState({ path: sessionFilePath });
    } catch (e) {
      console.error("Error saving session state:", e);
    }
  }
}
function cleanupSession4(chatId) {
  const session = activeSessions2.get(chatId);
  if (session) {
    clearTimeout(session.timeoutId);
    session.browser.close().catch(() => {
    });
    activeSessions2.delete(chatId);
  }
}
var TelegramBot = TelegramBotModule.default?.default || TelegramBotModule.default || TelegramBotModule;
var firebaseConfig = JSON.parse(
  import_fs8.default.readFileSync(import_path7.default.resolve("./firebase-applet-config.json"), "utf8")
);
var app = (0, import_app.initializeApp)(firebaseConfig);
var db = (0, import_firestore.initializeFirestore)(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);
var originalConsoleError = console.error;
var originalConsoleWarn = console.warn;
function isFirestoreIdleWarning(args) {
  const str = args.map((a) => String(a)).join(" ");
  return str.includes("CANCELLED: Disconnecting idle stream") || str.includes("Timed out waiting for new targets");
}
console.error = function(...args) {
  if (isFirestoreIdleWarning(args)) return;
  originalConsoleError.apply(console, args);
};
console.warn = function(...args) {
  if (isFirestoreIdleWarning(args)) return;
  originalConsoleWarn.apply(console, args);
};
var token = process.env.TELEGRAM_BOT_TOKEN || "8602774350:AAGhaSg22kz85pU8iCFVMkPybc1rhi1gMMw";
var adminChatIds = process.env.TELEGRAM_ADMIN_CHAT_ID ? process.env.TELEGRAM_ADMIN_CHAT_ID.split(",").map((s) => s.trim()) : ["7860277201"];
var FORCE_NORMAL_USER_MODE = false;
console.log("[CONFIG] Token loaded:", token.substring(0, 10) + "...");
console.log("[CONFIG] Admin IDs:", adminChatIds);
console.log("[CONFIG] FORCE_NORMAL_USER_MODE:", FORCE_NORMAL_USER_MODE);
var PROXY_CONFIG2 = {
  server: "http://geo.iproyal.com:12321",
  username: "T4Rw8zEYwYOch8Jy",
  password: "Jd2uEOIopKmWukQE_country-es_city-madrid"
};
var EXTERNAL_HOST = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
var useWebhook = !!EXTERNAL_HOST;
var TELEGRAM_PROXY = process.env.TELEGRAM_PROXY;
var botOptions = { polling: !useWebhook };
if (TELEGRAM_PROXY && !useWebhook) {
  console.log("Configuring Telegram bot to use proxy:", TELEGRAM_PROXY);
  const proxyAgent = new import_https_proxy_agent.HttpsProxyAgent(TELEGRAM_PROXY);
  botOptions.request = {
    agent: proxyAgent
  };
}
var bot2 = new TelegramBot(token, botOptions);
if (!useWebhook) {
  console.log("Starting Telegram Bot in POLLING mode.");
} else {
  console.log("Starting Telegram Bot in WEBHOOK mode. (URL:", EXTERNAL_HOST + ")");
}
initBotContext(bot2, activeSessions2, userStates2, cleanupSession4, persistSessionState4, PROXY_CONFIG2);
var getMainMenu = () => ({
  reply_markup: {
    keyboard: [
      [{ text: "\u{1F680} Fast Auto-Booking (No Browser)" }],
      [{ text: "\u{1F4C2} Draft Profiles" }],
      [{ text: "\u{1F4BE} Admin: Scrape Data (Launch Browser)" }]
    ],
    resize_keyboard: true
  }
});
var getNormalUserMenu = () => ({
  reply_markup: {
    keyboard: [
      [{ text: "\u{1F680} Fast Auto-Booking (No Browser)" }],
      [{ text: "\u{1F4C2} Draft Profiles" }]
    ],
    resize_keyboard: true
  }
});
bot2.on("polling_error", (error) => {
  if (error.code === "ETELEGRAM" && error.message.includes("409 Conflict")) {
    console.warn(
      "\u26A0\uFE0F Polling conflict detected (409). Another bot instance is still running."
    );
  } else if (error.code === "ETELEGRAM" && error.response?.status === 401) {
    console.error(
      "\u26A0\uFE0F Telegram Bot Token is invalid (401 Unauthorized). Stopping polling to prevent spam."
    );
    bot2.stopPolling();
  } else {
    console.error("Telegram polling error:", error.message);
  }
});
var globalAutofillData2 = {
  phone: "0034634224788",
  email: "zeshuhere055@gmail.com",
  nie: "",
  name: ""
};
var tokens = {};
var authorizedMachines = /* @__PURE__ */ new Set();
var pendingDurationForToken = {};
var pendingNameForToken = {};
var pendingDataField = {};
async function loadData() {
  try {
    const autofillDoc = await (0, import_firestore.getDoc)((0, import_firestore.doc)(db, "config", "autofill"));
    if (autofillDoc.exists()) {
      const data = autofillDoc.data();
      if (data) {
        globalAutofillData2.phone = data.phone || globalAutofillData2.phone;
        globalAutofillData2.email = data.email || globalAutofillData2.email;
        globalAutofillData2.nie = data.nie || globalAutofillData2.nie;
        globalAutofillData2.name = data.name || globalAutofillData2.name;
      }
    }
    (0, import_firestore.onSnapshot)((0, import_firestore.collection)(db, "tokens"), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "removed") {
          const t = change.doc.id;
          if (tokens[t] && tokens[t].machineId) {
            authorizedMachines.delete(tokens[t].machineId);
          }
          delete tokens[t];
        } else {
          const docId = change.doc.id;
          tokens[docId] = change.doc.data();
          if (tokens[docId].used && tokens[docId].machineId) {
            if (tokens[docId].expiresAt && Date.now() > tokens[docId].expiresAt) {
              authorizedMachines.delete(tokens[docId].machineId);
            } else {
              authorizedMachines.add(tokens[docId].machineId);
            }
          }
        }
      });
    }, (err) => {
      console.error("Firestore onSnapshot error on tokens:", err);
    });
    console.log("Loaded data from Firestore & set up listeners");
  } catch (err) {
    console.error("Error loading from Firestore:", err);
  }
}
async function saveAutofillData() {
  await (0, import_firestore.setDoc)((0, import_firestore.doc)(db, "config", "autofill"), globalAutofillData2);
}
async function saveToken(tokenId, tokenData) {
  await (0, import_firestore.setDoc)((0, import_firestore.doc)(db, "tokens", tokenId), tokenData);
}
bot2.onText(/\/menu/, (msg) => {
  const chatId = msg.chat.id;
  const isAdmin = FORCE_NORMAL_USER_MODE ? false : adminChatIds.includes(chatId.toString());
  if (!isAdmin) {
    bot2.sendMessage(chatId, "Main Menu:", getNormalUserMenu());
    return;
  }
  bot2.sendMessage(chatId, "Main Menu:", getMainMenu());
});
bot2.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const isAdmin = FORCE_NORMAL_USER_MODE ? false : adminChatIds.includes(chatId.toString());
  console.log(`[/start] chatId=${chatId} isAdmin=${isAdmin}`);
  if (!isAdmin) {
    const menu = getNormalUserMenu();
    console.log(`[/start] Sending normal user menu to ${chatId}`);
    console.log(`[/start] Menu object:`, JSON.stringify(menu, null, 2));
    bot2.sendMessage(
      chatId,
      "Welcome! Please select an option:",
      menu
    ).then(() => {
      console.log(`[/start] Message sent successfully to ${chatId}`);
    }).catch((err) => {
      console.error(`[/start] Error sending message to ${chatId}:`, err);
    });
    return;
  }
  console.log(`[/start] Sending admin menu to ${chatId}`);
  bot2.sendMessage(
    chatId,
    "Welcome Admin! Please select an option:",
    getMainMenu()
  ).then(() => {
    console.log(`[/start] Admin message sent successfully to ${chatId}`);
  }).catch((err) => {
    console.error(`[/start] Error sending admin message to ${chatId}:`, err);
  });
});
bot2.onText(/\/logout_(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const isAdmin = FORCE_NORMAL_USER_MODE ? false : adminChatIds.includes(chatId.toString());
  if (!isAdmin) return;
  const machineId = match[1];
  if (authorizedMachines.has(machineId)) {
    authorizedMachines.delete(machineId);
    let tokenToUpdate = null;
    for (const t in tokens) {
      if (tokens[t].machineId === machineId) {
        delete tokens[t].machineId;
        tokens[t].used = false;
        tokenToUpdate = t;
        break;
      }
    }
    if (tokenToUpdate) {
      saveToken(tokenToUpdate, tokens[tokenToUpdate]).catch(console.error);
    }
    bot2.sendMessage(chatId, `Machine ${machineId} has been logged out.`);
  } else {
    bot2.sendMessage(
      chatId,
      `Machine ${machineId} is not currently authorized.`
    );
  }
});
bot2.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  console.log(`[MSG] chatId=${chatId} text="${text}" admins=${JSON.stringify(adminChatIds)}`);
  const isAdmin = FORCE_NORMAL_USER_MODE ? false : adminChatIds.includes(chatId.toString());
  if (!text) return;
  if (text.startsWith("/start") || text.startsWith("/menu") || text.startsWith("/logout_")) {
    return;
  }
  if (!isAdmin) {
    const adminOnlyCommands = [
      "\u{1F4BE} Admin: Scrape Data (Launch Browser)",
      "gen token",
      "token history",
      "user list",
      "set phone",
      "set email"
    ];
    if (adminOnlyCommands.some((cmd) => text.startsWith(cmd))) {
      return;
    }
  } else {
  }
  if (claveAuthStates.has(chatId)) {
    const handled = await handleClavePasswordText(chatId, text);
    if (handled) return;
  }
  if (autofillState.has(chatId)) {
    const state = autofillState.get(chatId);
    if (state.step === "awaiting_nie") {
      state.nie = text.trim();
      state.step = "awaiting_name";
      bot2.sendMessage(chatId, "\u{1F4DD} Please reply with the full Name/Apellidos:");
      return;
    }
    if (state.step === "awaiting_name") {
      state.name = text.trim();
      autofillState.delete(chatId);
      bot2.sendMessage(chatId, "\u23F3 Processing...");
      await handleFormFill(chatId, state.queryId || "", state.nie, state.name);
      return;
    }
  }
  if (contactInfoState.has(chatId)) {
    const state = contactInfoState.get(chatId);
    if (state.step === "awaiting_phone") {
      state.phone = text.trim();
      state.step = "awaiting_email";
      bot2.sendMessage(chatId, "\u{1F4DD} Please reply with your Email Address:");
      return;
    }
    if (state.step === "awaiting_email") {
      state.email = text.trim();
      contactInfoState.delete(chatId);
      bot2.sendMessage(chatId, "\u23F3 Processing Contact Info...");
      await handleContactInfo(chatId, state.queryId || "", state.phone, state.email);
      return;
    }
  }
  if (text.startsWith("set phone ")) {
    globalAutofillData2.phone = text.replace("set phone ", "").trim();
    saveAutofillData().catch(console.error);
    bot2.sendMessage(
      chatId,
      `Phone updated to: ${globalAutofillData2.phone}`,
      getMainMenu()
    );
    return;
  }
  if (text.startsWith("set email ")) {
    globalAutofillData2.email = text.replace("set email ", "").trim();
    saveAutofillData().catch(console.error);
    bot2.sendMessage(
      chatId,
      `Email updated to: ${globalAutofillData2.email}`,
      getMainMenu()
    );
    return;
  }
  if (text === "\u{1F4BE} Admin: Scrape Data (Launch Browser)") {
    browserQueue.enqueue(async () => {
      await handleLaunchBrowser(chatId);
    }, (pos) => {
      bot2.sendMessage(chatId, `\u23F3 You are in queue (Position: ${pos}). Please wait, your browser will launch automatically when it's your turn...`);
    });
    return;
  }
  try {
    const fastChat = await Promise.resolve().then(() => (init_fastChatMenu(), fastChatMenu_exports));
    if (fastChat.handleFastChatText(bot2, chatId, text)) return;
  } catch (e) {
  }
  if (text === "\u{1F680} Fast Auto-Booking (No Browser)") {
    Promise.resolve().then(() => (init_fastChatMenu(), fastChatMenu_exports)).then((module2) => {
      module2.startFastChat(bot2, chatId);
    }).catch((err) => {
      console.error(err);
      bot2.sendMessage(chatId, "\u26A0\uFE0F Fast mode module is not compiled or missing.");
    });
    return;
  }
  if (text === "\u{1F4C2} Draft Profiles" || text === "/profiles" || text === "/drafts") {
    Promise.resolve().then(() => (init_fastChatMenu(), fastChatMenu_exports)).then((module2) => {
      module2.showDraftProfiles(bot2, chatId);
    }).catch((err) => {
      console.error(err);
      bot2.sendMessage(chatId, "\u26A0\uFE0F Fast mode module is not compiled or missing.");
    });
    return;
  }
  if (text === "/test_calendar") {
    Promise.resolve().then(() => (init_dateCalendarMenu(), dateCalendarMenu_exports)).then((module2) => {
      module2.sendDateSelectionMenu(bot2, chatId);
    }).catch((err) => console.error(err));
    return;
  }
  if (text === "gen token") {
    pendingDurationForToken[chatId] = true;
    bot2.sendMessage(chatId, "Please select the token duration:", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "1 Week", callback_data: "gen_week" },
            { text: "1 Month", callback_data: "gen_month" }
          ]
        ]
      }
    });
    return;
  }
  if (pendingNameForToken[chatId]) {
    const duration = pendingNameForToken[chatId].duration;
    const personName = text.trim();
    const newToken = import_crypto6.default.randomBytes(4).toString("hex").toUpperCase();
    const now = Date.now();
    const expiresAt = duration === "week" ? now + 7 * 24 * 60 * 60 * 1e3 : now + 30 * 24 * 60 * 60 * 1e3;
    tokens[newToken] = {
      used: false,
      assignedTo: personName,
      duration,
      expiresAt
    };
    saveToken(newToken, tokens[newToken]).catch(console.error);
    bot2.sendMessage(
      chatId,
      `\u2705 Token generated for <b>${personName}</b>:
Duration: ${duration === "week" ? "1 Week" : "1 Month"}

<code>${newToken}</code>`,
      { parse_mode: "HTML" }
    );
    delete pendingNameForToken[chatId];
    return;
  }
  if (text === "token history") {
    let history = "";
    for (const [t, data] of Object.entries(tokens)) {
      history += `Token: <code>${t}</code>
Assigned: ${data.assignedTo}
Used: ${data.used ? "Yes" : "No"}

`;
    }
    bot2.sendMessage(
      chatId,
      history || "No tokens generated yet.",
      getMainMenu()
    );
  }
  if (text === "user list") {
    let msgList = "<b>Authorized Machines:</b>\n\n";
    const inlineKeyboard = [];
    if (authorizedMachines.size === 0) {
      msgList += "No machines are currently authorized.";
    } else {
      authorizedMachines.forEach((machineId) => {
        let assignedTo = "Unknown";
        for (const t in tokens) {
          if (tokens[t].machineId === machineId) {
            assignedTo = tokens[t].assignedTo || "Unknown";
          }
        }
        msgList += `\u{1F464} ${assignedTo}
\u{1F4BB} <code>${machineId}</code>

`;
        inlineKeyboard.push([
          {
            text: `Logout ${assignedTo}`,
            callback_data: `logout_${machineId}`
          }
        ]);
      });
    }
    bot2.sendMessage(chatId, msgList, {
      parse_mode: "HTML",
      reply_markup: inlineKeyboard.length > 0 ? { inline_keyboard: inlineKeyboard } : void 0
    });
  }
});
bot2.on("document", async (msg) => {
  const chatId = msg.chat.id;
  const isAdmin = FORCE_NORMAL_USER_MODE ? false : adminChatIds.includes(chatId.toString());
  const doc2 = msg.document;
  if (!doc2) return;
  const fileName = doc2.file_name || "";
  const ext = fileName.toLowerCase();
  if (isAdmin && (ext.endsWith(".js") || ext.endsWith(".mjs"))) {
    try {
      const fileLink = await bot2.getFileLink(doc2.file_id);
      const response = await fetch(fileLink);
      if (!response.ok) throw new Error("Failed to download file");
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await handleScriptUpload(chatId, fileName, buffer);
    } catch (err) {
      await bot2.sendMessage(chatId, `\u274C Error downloading file: ${err.message}`);
    }
    return;
  }
  if (!claveAuthStates.has(chatId)) return;
  if (!ext.endsWith(".p12")) {
    await bot2.sendMessage(chatId, "\u26A0\uFE0F Please upload a `.p12` file.", { parse_mode: "Markdown" });
    return;
  }
  try {
    const fileLink = await bot2.getFileLink(doc2.file_id);
    const response = await fetch(fileLink);
    if (!response.ok) throw new Error("Failed to download file");
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await handleClaveDocument(chatId, fileName, buffer);
  } catch (err) {
    await bot2.sendMessage(chatId, `\u274C Error downloading file: ${err.message}`);
  }
});
bot2.on("callback_query", async (query) => {
  const chatId = query.message?.chat.id;
  if (!chatId) return;
  const isAdmin = FORCE_NORMAL_USER_MODE ? false : adminChatIds.includes(chatId.toString());
  const data = query.data;
  if (!isAdmin) {
    const adminOnlyPatterns = ["gen_week", "gen_month", "edit_", "logout_"];
    if (data && adminOnlyPatterns.some((pattern) => data.startsWith(pattern))) {
      return;
    }
  }
  if (data) {
    try {
      const fastChat = await Promise.resolve().then(() => (init_fastChatMenu(), fastChatMenu_exports));
      if (fastChat.handleFastChatCallback(bot2, chatId, data, query.id, query.message?.message_id)) return;
    } catch (e) {
    }
    try {
      const calMenu = await Promise.resolve().then(() => (init_dateCalendarMenu(), dateCalendarMenu_exports));
      if (await calMenu.handleDateCalendarCallback(bot2, chatId, data, query.id, query.message?.message_id)) return;
    } catch (e) {
    }
  }
  if (data === "close_browser") {
    cleanupSession4(chatId);
    bot2.sendMessage(chatId, "\u{1F6D1} Browser session closed successfully. MBs saved!");
    bot2.answerCallbackQuery(query.id);
    return;
  }
  if (data === "run_custom_extraction") {
    if (!isAdmin) {
      bot2.answerCallbackQuery(query.id);
      return;
    }
    bot2.answerCallbackQuery(query.id);
    await executeCustomScript(chatId);
    return;
  }
  if (data && data.startsWith("dyn_")) {
    const index = parseInt(data.replace("dyn_", ""), 10);
    const { handleDynamicClick: handleDynamicClick2 } = await Promise.resolve().then(() => (init_handleDynamicClick(), handleDynamicClick_exports));
    await handleDynamicClick2(chatId, query.id, index);
    return;
  }
  if (data && data.startsWith("prov_")) {
    const index = parseInt(data.replace("prov_", ""));
    await handleProvinceSelection(chatId, query.id, index);
    return;
  }
  if (data && data.startsWith("office_")) {
    const index = parseInt(data.replace("office_", ""), 10);
    await handleOfficeSelection(chatId, query.id, index);
    return;
  }
  if (data && data.startsWith("tramite_")) {
    const index = parseInt(data.replace("tramite_", ""), 10);
    await handleTramiteSelection(chatId, query.id, index);
    return;
  }
  if (data === "autofill_form") {
    autofillState.set(chatId, { step: "awaiting_nie", queryId: query.id });
    bot2.sendMessage(chatId, "\u{1F4DD} Please reply with the NIE/DNI:");
    bot2.answerCallbackQuery(query.id);
    return;
  }
  if (data === "fill_contact") {
    contactInfoState.set(chatId, { step: "awaiting_phone", queryId: query.id });
    bot2.sendMessage(chatId, "\u{1F4DD} Please reply with your Phone Number:");
    bot2.answerCallbackQuery(query.id);
    return;
  }
  if (data === "gen_week" || data === "gen_month") {
    const duration = data === "gen_week" ? "week" : "month";
    delete pendingDurationForToken[chatId];
    pendingNameForToken[chatId] = { duration };
    bot2.sendMessage(
      chatId,
      `Duration selected: ${duration === "week" ? "1 Week" : "1 Month"}. Please enter the name of the person for this token:`
    );
    bot2.answerCallbackQuery(query.id);
    return;
  }
  if (data && data.startsWith("edit_")) {
    const field = data.replace("edit_", "");
    pendingDataField[chatId] = field;
    bot2.sendMessage(chatId, `Please enter the new ${field.toUpperCase()}:`);
    bot2.answerCallbackQuery(query.id);
    return;
  }
  if (data && data.startsWith("logout_")) {
    const machineId = data.replace("logout_", "");
    if (authorizedMachines.has(machineId)) {
      authorizedMachines.delete(machineId);
      let tokenToUpdate = null;
      for (const t in tokens) {
        if (tokens[t].machineId === machineId) {
          delete tokens[t].machineId;
          tokens[t].used = false;
          tokenToUpdate = t;
          break;
        }
      }
      if (tokenToUpdate) {
        saveToken(tokenToUpdate, tokens[tokenToUpdate]).catch(console.error);
      }
      bot2.sendMessage(chatId, `Machine ${machineId} has been logged out.`);
      bot2.answerCallbackQuery(query.id, { text: `Logged out ${machineId}` });
      bot2.sendMessage(
        chatId,
        `Machine ${machineId} is not currently authorized.`
      );
      bot2.answerCallbackQuery(query.id, { text: `Already logged out` });
    }
  }
});
async function startServer() {
  const app2 = (0, import_express.default)();
  const PORT = parseInt(process.env.PORT || "3000", 10);
  app2.use(import_express.default.json());
  app2.use(import_express.default.static(import_path7.default.join(process.cwd(), "public")));
  app2.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: useWebhook ? "webhook" : "polling" });
  });
  if (useWebhook) {
    const webhookPath = "/bot" + token;
    const webhookUrl = EXTERNAL_HOST + webhookPath;
    app2.post(webhookPath, (req, res) => {
      bot2.processUpdate(req.body);
      res.sendStatus(200);
    });
    try {
      let success = false;
      for (let i = 0; i < 3; i++) {
        try {
          await bot2.setWebHook(webhookUrl);
          console.log("\u2705 Webhook successfully set to:", webhookUrl);
          success = true;
          break;
        } catch (e) {
          console.log(`Webhook attempt ${i + 1} failed...`);
          await new Promise((r) => setTimeout(r, 2e3));
        }
      }
      if (!success) {
        console.error("\u274C Failed to set webhook after 3 attempts. Falling back to POLLING.");
        bot2.startPolling();
      }
    } catch (e) {
      console.error("\u274C Error in webhook setup:", e);
      bot2.startPolling();
    }
  } else {
    try {
      await bot2.deleteWebHook();
    } catch (e) {
    }
  }
  app2.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  bot2.stopPolling();
  process.exit(0);
});
process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  bot2.stopPolling();
  process.exit(0);
});
loadData().then(() => startServer());
//# sourceMappingURL=server.cjs.map
