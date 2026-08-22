import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import * as TelegramBotModule from "node-telegram-bot-api";
import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Apply stealth plugin to Playwright
chromium.use(StealthPlugin());

interface UserState {
  province?: { text: string; value: string };
  office?: { text: string; value: string };
  tramite?: { text: string; value: string };
}

const userStates = new Map<number, UserState>();

const sessionsDir = path.resolve("./sessions");
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}

interface ActiveSession {
  browser: any;
  context: any;
  page: any;
  timeoutId: NodeJS.Timeout;
  provinces?: { text: string; value: string }[];
  offices?: { text: string; value: string; selectId?: string; selectName?: string }[];
  tramites?: { text: string; value: string; selectId?: string; selectName?: string }[];
}
const activeSessions = new Map<number, ActiveSession>();

async function persistSessionState(chatId: number) {
  const session = activeSessions.get(chatId);
  if (session && session.context) {
    try {
      const sessionFilePath = path.resolve(`./sessions/${chatId}.json`);
      await session.context.storageState({ path: sessionFilePath });
    } catch (e) {
      console.error("Error saving session state:", e);
    }
  }
}

function cleanupSession(chatId: number) {
  const session = activeSessions.get(chatId);
  if (session) {
    clearTimeout(session.timeoutId);
    session.browser.close().catch(() => {});
    activeSessions.delete(chatId);
  }
}

const TelegramBot =
  (TelegramBotModule as any).default?.default ||
  (TelegramBotModule as any).default ||
  TelegramBotModule;

// Initialize Firebase using Client SDK
const firebaseConfig = JSON.parse(
  fs.readFileSync(path.resolve("./firebase-applet-config.json"), "utf8"),
);
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);

// Suppress benign Firestore gRPC idle stream disconnect warnings
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function isFirestoreIdleWarning(args: any[]) {
  const str = args.map(a => String(a)).join(" ");
  return str.includes("CANCELLED: Disconnecting idle stream") || str.includes("Timed out waiting for new targets");
}

console.error = function (...args) {
  if (isFirestoreIdleWarning(args)) return;
  originalConsoleError.apply(console, args);
};

console.warn = function (...args) {
  if (isFirestoreIdleWarning(args)) return;
  originalConsoleWarn.apply(console, args);
};


const token = "8602774350:AAGhaSg22kz85pU8iCFVMkPybc1rhi1gMMw";
const adminChatIds = ["7860277201"];

// IPRoyal Spanish Proxy Configuration
const PROXY_CONFIG = {
  server: "http://geo.iproyal.com:12321",
  username: "T4Rw8zEYwYOch8Jy",
  password: "Jd2uEOIopKmWukQE_country-es_city-madrid"
};

// Check if running in AI Studio
const isAIStudio =
  process.env.APP_URL &&
  (process.env.APP_URL.includes("ais-dev") ||
    process.env.APP_URL.includes("ais-pre"));

const bot = new TelegramBot(token, { polling: true });

const getMainMenu = () => ({
  reply_markup: {
    keyboard: [
      [{ text: "gen token" }],
      [{ text: "token history" }, { text: "user list" }],
      [{ text: "Data & Autofill" }, { text: "Launch Cloud Browser" }],
    ],
    resize_keyboard: true,
  },
});

if (isAIStudio) {
  console.log(
    "⚠️ Telegram polling is DISABLED in AI Studio to prevent 409 conflicts with Render.",
  );
}

bot.on("polling_error", (error: any) => {
  if (error.code === "ETELEGRAM" && error.message.includes("409 Conflict")) {
    console.warn(
      "⚠️ Polling conflict detected (409). Another bot instance is still running.",
    );
    // Let it keep trying if they want it working here
  } else if (error.code === "ETELEGRAM" && error.response?.status === 401) {
    console.error(
      "⚠️ Telegram Bot Token is invalid (401 Unauthorized). Stopping polling to prevent spam.",
    );
    bot.stopPolling();
  } else {
    console.error("Telegram polling error:", error.message);
  }
});

// Data stores (in memory for simplicity in this demo)
let globalAutofillData = {
  phone: "0034634224788",
  email: "zeshuhere055@gmail.com",
  nie: "",
  name: "",
};

type TokenData = {
  used: boolean;
  machineId?: string;
  assignedTo?: string;
  usedAt?: number;
  duration?: "week" | "month";
  expiresAt?: number;
};

const tokens: { [key: string]: TokenData } = {};
const authorizedMachines = new Set<string>();
const pendingDurationForToken: Record<string, boolean> = {};
const pendingNameForToken: Record<string, { duration: "week" | "month" }> = {};
const pendingDataField: Record<string, string> = {};

async function loadData() {
  try {
    const autofillDoc = await getDoc(doc(db, "config", "autofill"));
    if (autofillDoc.exists()) {
      const data = autofillDoc.data();
      if (data) {
        globalAutofillData.phone = data.phone || globalAutofillData.phone;
        globalAutofillData.email = data.email || globalAutofillData.email;
        globalAutofillData.nie = data.nie || globalAutofillData.nie;
        globalAutofillData.name = data.name || globalAutofillData.name;
      }
    }

    onSnapshot(collection(db, "tokens"), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "removed") {
          const t = change.doc.id;
          if (tokens[t] && tokens[t].machineId) {
            authorizedMachines.delete(tokens[t].machineId!);
          }
          delete tokens[t];
        } else {
          const docId = change.doc.id;
          tokens[docId] = change.doc.data() as TokenData;
          if (tokens[docId].used && tokens[docId].machineId) {
            if (tokens[docId].expiresAt && Date.now() > tokens[docId].expiresAt!) {
              authorizedMachines.delete(tokens[docId].machineId!);
            } else {
              authorizedMachines.add(tokens[docId].machineId!);
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
  await setDoc(doc(db, "config", "autofill"), globalAutofillData);
}

async function saveToken(tokenId: string, tokenData: TokenData) {
  await setDoc(doc(db, "tokens", tokenId), tokenData);
}

bot.onText(/\/menu/, (msg) => {
  const chatId = msg.chat.id;
  if (!adminChatIds.includes(chatId.toString())) return;
  bot.sendMessage(chatId, "Main Menu:", getMainMenu());
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (!adminChatIds.includes(chatId.toString())) {
    bot.sendMessage(chatId, "You are not authorized.");
    return;
  }

  bot.sendMessage(
    chatId,
    "Welcome Admin! Please select an option:",
    getMainMenu(),
  );
});

bot.onText(/\/logout_(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  if (!adminChatIds.includes(chatId.toString())) return;
  const machineId = match![1];
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

    bot.sendMessage(chatId, `Machine ${machineId} has been logged out.`);
  } else {
    bot.sendMessage(
      chatId,
      `Machine ${machineId} is not currently authorized.`,
    );
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || !adminChatIds.includes(chatId.toString())) return;

  if (text.startsWith("set phone ")) {
    globalAutofillData.phone = text.replace("set phone ", "").trim();
    saveAutofillData().catch(console.error);
    bot.sendMessage(
      chatId,
      `Phone updated to: ${globalAutofillData.phone}`,
      getMainMenu(),
    );
    return;
  }
  if (text.startsWith("set email ")) {
    globalAutofillData.email = text.replace("set email ", "").trim();
    saveAutofillData().catch(console.error);
    bot.sendMessage(
      chatId,
      `Email updated to: ${globalAutofillData.email}`,
      getMainMenu(),
    );
    return;
  }

  if (text === "Data & Autofill") {
    const msgList = `<b>Current Autofill Data:</b>
Phone: <code>${globalAutofillData.phone}</code>
Email: <code>${globalAutofillData.email}</code>
`;

    bot.sendMessage(chatId, msgList, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Edit Phone", callback_data: "edit_phone" },
            { text: "Edit Email", callback_data: "edit_email" },
          ],
        ],
      },
    });
    return;
  }

  if (pendingDataField[chatId]) {
    const field = pendingDataField[chatId];
    globalAutofillData[field as keyof typeof globalAutofillData] = text.trim();
    saveAutofillData().catch(console.error);
    bot.sendMessage(
      chatId,
      `✅ ${field.toUpperCase()} updated to: ${globalAutofillData[field as keyof typeof globalAutofillData]}`,
      getMainMenu(),
    );
    delete pendingDataField[chatId];
    return;
  }

  if (text === "Launch Cloud Browser") {
    bot.sendMessage(chatId, "⏳ Launching Playwright browser in the cloud with Spanish Residential Proxy (IPRoyal Madrid)...");
    
    // Clean up any existing session for this user
    cleanupSession(chatId);

    let browser;
    try {
      const sessionStr = crypto.createHash('md5').update(chatId.toString()).digest('hex').substring(0, 8);
      const randomPassword = `${PROXY_CONFIG.password}_session-${sessionStr}`;
      
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-blink-features=AutomationControlled'
        ],
        proxy: {
          server: PROXY_CONFIG.server,
          username: PROXY_CONFIG.username,
          password: randomPassword
        }
      });
      
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15'
      ];
      const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

      const sessionFilePath = path.resolve(`./sessions/${chatId}.json`);
      const contextOptions: any = {
        locale: 'es-ES',
        timezoneId: 'Europe/Madrid',
        userAgent: randomUserAgent
      };
      if (fs.existsSync(sessionFilePath)) {
        contextOptions.storageState = sessionFilePath;
      }

      const context = await browser.newContext(contextOptions);
      const page = await context.newPage();
      
      // Save proxy bandwidth by blocking images, media, and fonts
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'media', 'font'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });
      
      // Additional stealth measure just in case
      await page.addInitScript("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})");
        
      bot.sendMessage(chatId, "🌐 Browser opened! Navigating to Extranjería (this might take a bit via Spanish Proxy)...");
      
      // Residential proxies are slow, so give it ample time
      await page.goto('https://sede.administracionespublicas.gob.es/pagina/index/directorio/icpplus', { waitUntil: 'load', timeout: 60000 });
      
      // Cookie/Overlay Dismissal Logic
      try {
          await page.evaluate(() => {
              // 1. Try to click standard cookie acceptance buttons
              const btns = Array.from(document.querySelectorAll('button, a, input'));
              for (const btn of btns) {
                  const txt = (btn.textContent || (btn as HTMLInputElement).value || '').toLowerCase();
                  if (txt.includes('aceptar cookie') || txt.includes('accept cookies') || txt.includes('entendido') || txt.includes('de acuerdo')) {
                      (btn as HTMLElement).click();
                  }
              }
              // 2. Hide common cookie overlays physically to prevent click interception
              const overlays = document.querySelectorAll('[id*="cookie"], [class*="cookie"], [id*="aviso"], [class*="aviso"]');
              overlays.forEach(o => { (o as HTMLElement).style.display = 'none'; });
          });
          await page.waitForTimeout(1000);
      } catch (e) {}

      bot.sendMessage(chatId, "👉 Checking if '#submit' button exists...");
      
      try {
        const buttonElement = await page.$('#submit');
        if (buttonElement) {
          bot.sendMessage(chatId, "👉 Button found! Clicking it and waiting for next page...");
          await page.waitForTimeout(Math.floor(Math.random() * 1500) + 1000);
          await page.hover('#submit').catch(() => {});
          await page.waitForTimeout(Math.floor(Math.random() * 300) + 200);
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),
            page.click('#submit', { delay: Math.floor(Math.random() * 100) + 50, timeout: 5000 }).catch(() => {})
          ]);
          bot.sendMessage(chatId, "✅ Navigation completed.");
        } else {
          bot.sendMessage(chatId, "⚠️ Could not find the '#submit' button on this page.");
        }
      } catch (err: any) {
        bot.sendMessage(chatId, `⚠️ Click/Nav error (ignoring): ${err.message}`);
      }
      
      bot.sendMessage(chatId, "⏳ Waiting for the province page to fully load via proxy (timeout 30s)...");
      try {
         // Wait specifically for the dropdown to appear
         await page.waitForSelector('select#form', { timeout: 30000 });
      } catch (e) {
         bot.sendMessage(chatId, "⚠️ Could not find province dropdown within 30 seconds. The site might be extremely slow or down.");
      }
      
      bot.sendMessage(chatId, "🛑 Force-stopping any pending background resources to stabilize...");
      try {
        // Removed window.stop() to allow CSS to load
      } catch (e) {}

      bot.sendMessage(chatId, "🔍 Extracting page data...");
      
      try {
        // Extract provinces
        const provinces = await page.$$eval('select#form option', options => {
          return options
            .map(o => ({ text: o.textContent?.trim() || '', value: (o as HTMLOptionElement).value }))
            .filter(o => o.value !== '' && !o.text.includes('Seleccione'));
        });

        if (provinces && provinces.length > 0) {
           bot.sendMessage(chatId, `✅ Found ${provinces.length} provinces.`);
           
           // Take screenshot for context
           const screenshotBuffer = await page.screenshot({ 
             timeout: 60000, 
             animations: 'disabled',
             type: 'jpeg',
             quality: 40
           });
           await bot.sendPhoto(chatId, screenshotBuffer, { caption: "Here is the current screen." });

           // Build inline keyboard
           const inlineKeyboard = [];
           for (let i = 0; i < provinces.length; i += 4) {
             const row = [];
             for (let j = 0; j < 4; j++) {
               if (provinces[i + j]) {
                 row.push({ text: provinces[i + j].text, callback_data: `prov_${i + j}` });
               }
             }
             inlineKeyboard.push(row);
           }
    
           bot.sendMessage(chatId, "📍 Please select a province:", {
             reply_markup: { inline_keyboard: inlineKeyboard }
           });
    
           // Save session
           const timeoutId = setTimeout(() => {
              bot.sendMessage(chatId, "⏳ Session expired due to 10 minutes of inactivity. Please launch the browser again.");
              cleanupSession(chatId);
           }, 10 * 60 * 1000); // 10 minutes
    
           activeSessions.set(chatId, { browser, context, page, timeoutId, provinces });
           await persistSessionState(chatId);

        } else {
           let pageText = "Unknown";
           try {
               pageText = await page.evaluate(() => document.body ? document.body.innerText.substring(0, 500) : "No body");
           } catch(e) {}
           
           bot.sendMessage(chatId, `⚠️ Could not find the province dropdown.\n📝 Page text snippet:\n${pageText}\n\nTaking screenshot to see what went wrong...`);
           try {
             const screenshotBuffer = await page.screenshot({ timeout: 60000, type: 'jpeg', quality: 40 });
             await bot.sendPhoto(chatId, screenshotBuffer);
           } catch(e: any) {
             bot.sendMessage(chatId, `❌ Failed to take screenshot: ${e.message}`);
           }
           await browser.close();
        }

      } catch (err: any) {
         bot.sendMessage(chatId, `⚠️ Failed to extract provinces: ${err.message}`);
         await browser.close();
      }

    } catch (error: any) {
      if (browser) await browser.close();
      bot.sendMessage(chatId, `❌ Error running Playwright:\n${error.message}`);
    }
    return;
  }

  if (text === "gen token") {
    pendingDurationForToken[chatId] = true;
    bot.sendMessage(chatId, "Please select the token duration:", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "1 Week", callback_data: "gen_week" },
            { text: "1 Month", callback_data: "gen_month" },
          ],
        ],
      },
    });
    return;
  }

  if (pendingNameForToken[chatId]) {
    const duration = pendingNameForToken[chatId].duration;
    const personName = text.trim();
    const newToken = crypto.randomBytes(4).toString("hex").toUpperCase();

    // Calculate expiration
    const now = Date.now();
    const expiresAt =
      duration === "week"
        ? now + 7 * 24 * 60 * 60 * 1000
        : now + 30 * 24 * 60 * 60 * 1000;

    tokens[newToken] = {
      used: false,
      assignedTo: personName,
      duration,
      expiresAt,
    };
    saveToken(newToken, tokens[newToken]).catch(console.error);

    bot.sendMessage(
      chatId,
      `✅ Token generated for <b>${personName}</b>:
Duration: ${duration === "week" ? "1 Week" : "1 Month"}

<code>${newToken}</code>`,
      { parse_mode: "HTML" },
    );
    delete pendingNameForToken[chatId];
    return;
  }

  if (text === "token history") {
    let history = "";
    for (const [t, data] of Object.entries(tokens)) {
      history += `Token: <code>${t}</code>\nAssigned: ${data.assignedTo}\nUsed: ${data.used ? "Yes" : "No"}\n\n`;
    }
    bot.sendMessage(
      chatId,
      history || "No tokens generated yet.",
      getMainMenu(),
    );
  }

  if (text === "user list") {
    let msgList = "<b>Authorized Machines:</b>\n\n";
    const inlineKeyboard = [];
    if (authorizedMachines.size === 0) {
      msgList += "No machines are currently authorized.";
    } else {
      authorizedMachines.forEach((machineId) => {
        // Find who this machine belongs to
        let assignedTo = "Unknown";
        for (const t in tokens) {
          if (tokens[t].machineId === machineId) {
            assignedTo = tokens[t].assignedTo || "Unknown";
          }
        }
        msgList += `👤 ${assignedTo}\n💻 <code>${machineId}</code>\n\n`;
        inlineKeyboard.push([
          {
            text: `Logout ${assignedTo}`,
            callback_data: `logout_${machineId}`,
          },
        ]);
      });
    }
    bot.sendMessage(chatId, msgList, {
      parse_mode: "HTML",
      reply_markup:
        inlineKeyboard.length > 0
          ? { inline_keyboard: inlineKeyboard }
          : undefined,
    });
  }
});

bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat.id;
  if (!chatId || !adminChatIds.includes(chatId.toString())) return;
  const data = query.data;

  if (data && data.startsWith("prov_")) {
    const index = parseInt(data.replace("prov_", ""));
    const session = activeSessions.get(chatId);

    if (!session) {
      bot.sendMessage(chatId, "⚠️ Session expired. Please click 'Launch Cloud Browser' again.");
      bot.answerCallbackQuery(query.id);
      return;
    }

    const { page, provinces } = session;
    const selectedProv = provinces?.[index];

    if (!selectedProv) {
       bot.sendMessage(chatId, "⚠️ Invalid province selection.");
       bot.answerCallbackQuery(query.id);
       return;
    }

    if (!userStates.has(chatId)) userStates.set(chatId, {});
    userStates.get(chatId)!.province = selectedProv;

    bot.sendMessage(chatId, `🔄 Selecting province: ${selectedProv.text}...`);
    bot.answerCallbackQuery(query.id);

    try {
      // Select the province
      try {
          await page.selectOption('select#form', selectedProv.value);
      } catch (e) {}
      
      // Ensure the site registers the selection via JS events
      try {
          await page.evaluate(() => {
              const selectElement = document.querySelector('select#form');
              if (selectElement) {
                  selectElement.dispatchEvent(new Event('change', { bubbles: true }));
              }
          });
      } catch (e) {}
      await page.waitForTimeout(2000); // Give JS time to process

      bot.sendMessage(chatId, `✅ Province selected in dropdown. Clicking 'Aceptar'...`);

      try {
        const preUrl = page.url();
        const btnSelector = '#btnAceptar, input[value="Aceptar"]';
        
        // Hide potential overlays before click
        await page.evaluate(() => {
            const overlays = document.querySelectorAll('[id*="cookie"], [class*="cookie"], [id*="aviso"], [class*="aviso"]');
            overlays.forEach(o => { (o as HTMLElement).style.display = 'none'; });
        }).catch(() => {});

        await page.waitForTimeout(Math.floor(Math.random() * 2000) + 1500);
        await page.hover(btnSelector).catch(() => {});
        await page.waitForTimeout(Math.floor(Math.random() * 400) + 200);
        
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),
          page.click(btnSelector, { delay: Math.floor(Math.random() * 150) + 50 }).catch(() => {})
        ]);
        
        if (page.url() === preUrl) {
           bot.sendMessage(chatId, "⚠️ URL didn't change native click. Retrying via trusted event...");
           await Promise.all([
             page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),
             page.evaluate((sel: string) => {
                 const el = document.querySelector(sel);
                 if (el) {
                     const evt = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
                     el.dispatchEvent(evt);
                 }
             }, btnSelector).catch(() => {})
           ]);
        }
      } catch (clickErr: any) {
        bot.sendMessage(chatId, `⚠️ Navigation error: ${clickErr.message}`);
      }

      bot.sendMessage(chatId, "⏳ Waiting 10 seconds for the next page to fully render via proxy...");
      await page.waitForTimeout(10000); // Hard wait to ensure the proxy has loaded the next page

      bot.sendMessage(chatId, "📸 Next page loaded. Taking screenshot...");

      // Force stop just in case
      // Removed window.stop() to allow CSS to load

      const screenshotBuffer = await page.screenshot({
        timeout: 30000,
        animations: 'disabled',
        type: 'jpeg',
        quality: 40
      });

      bot.sendPhoto(chatId, screenshotBuffer, { caption: `✅ Selected: ${selectedProv.text}\nExtracting available offices...` });
      await persistSessionState(chatId);

      try {
        // Wait for any select element that is likely the office dropdown
        await page.waitForFunction(() => {
            const selects = Array.from(document.querySelectorAll('select'));
            return selects.some(s => s.id.toLowerCase().includes('sede') || s.name.toLowerCase().includes('sede'));
        }, { timeout: 15000 }).catch(() => {});
        
        const offices = await page.$$eval('select', (selects: HTMLSelectElement[]) => {
          let targetSelect = selects.find(s => s.id.toLowerCase().includes('sede') || s.name.toLowerCase().includes('sede'));
          if (!targetSelect) {
              // Fallback: Find select containing 'oficina'
              targetSelect = selects.find(s => {
                 if (s.id.toLowerCase().includes('tramite') || s.name.toLowerCase().includes('tramite')) return false;
                 return Array.from(s.options).some(o => o.text.toLowerCase().includes('oficina'));
              });
          }
          if (targetSelect) {
             return Array.from(targetSelect.options)
               .map(o => ({ text: o.textContent?.trim() || '', value: o.value, selectId: targetSelect!.id, selectName: targetSelect!.name }))
               .filter(o => o.value !== '' && o.value !== '-1' && !o.text.toLowerCase().includes('selecciona oficina'));
          }
          return [];
        });

        if (offices && offices.length > 0) {
          session.offices = offices;
          bot.sendMessage(chatId, `✅ Found ${offices.length} offices.`);
          
          const inlineKeyboard = [];
          for (let i = 0; i < offices.length; i++) {
            let buttonText = offices[i].text;
            if (buttonText.length > 60) buttonText = buttonText.substring(0, 57) + "...";
            inlineKeyboard.push([{ text: buttonText, callback_data: `office_${i}` }]);
          }

          bot.sendMessage(chatId, "🏢 Please select an office:", {
            reply_markup: { inline_keyboard: inlineKeyboard }
          });
        } else {
          bot.sendMessage(chatId, "⚠️ Could not find any offices in the dropdown.");
        }
      } catch (e: any) {
        bot.sendMessage(chatId, `⚠️ Could not locate the offices dropdown ('select#sede'). The site might require a different step or there are no offices available.\nError: ${e.message}`);
      }

      // Reset timeout
      clearTimeout(session.timeoutId);
      session.timeoutId = setTimeout(() => {
        bot.sendMessage(chatId, "⏳ Session expired due to 10 minutes of inactivity.");
        cleanupSession(chatId);
      }, 10 * 60 * 1000);

    } catch (error: any) {
       bot.sendMessage(chatId, `❌ Error moving to next step:\n${error.message}\n\n📸 Taking debug screenshot...`);
       try {
           const errImg = await page.screenshot({ timeout: 15000, type: 'jpeg', quality: 40 });
           bot.sendPhoto(chatId, errImg, { caption: "Debug screenshot of the error state." });
       } catch (e) {}
       // We won't strictly kill the session here, so the user can see the error and we can still try to recover if needed.
       // cleanupSession(chatId);
    }
    return;
  }

  if (data && data.startsWith("office_")) {
    const index = parseInt(data.replace("office_", ""), 10);
    const session = activeSessions.get(chatId);

    if (!session) {
      bot.sendMessage(chatId, "⚠️ Session expired. Please click 'Launch Cloud Browser' again.");
      bot.answerCallbackQuery(query.id);
      return;
    }

    const { page, offices } = session;
    const selectedOffice = offices?.[index];

    if (!selectedOffice) {
       bot.sendMessage(chatId, "⚠️ Invalid office selection.");
       bot.answerCallbackQuery(query.id);
       return;
    }

    if (!userStates.has(chatId)) userStates.set(chatId, {});
    userStates.get(chatId)!.office = selectedOffice;

    bot.sendMessage(chatId, `🔄 Selecting office: ${selectedOffice.text}...`);
    bot.answerCallbackQuery(query.id);

    try {
      // Select the office
      try {
          if (selectedOffice.selectId) {
              await page.selectOption(`select[id="${selectedOffice.selectId}"]`, selectedOffice.value).catch(() => {});
          } else if (selectedOffice.selectName) {
              await page.selectOption(`select[name="${selectedOffice.selectName}"]`, selectedOffice.value).catch(() => {});
          } else {
              await page.selectOption('select#sede', selectedOffice.value).catch(() => {});
          }
      } catch (e) {}
      
      // Ensure the site registers the selection via JS events (crucial for AJAX loading next dropdowns)
      try {
          await page.evaluate((val) => {
              const selects = Array.from(document.querySelectorAll('select'));
              let targetSelect = selects.find(s => s.id.toLowerCase().includes('sede') || s.name.toLowerCase().includes('sede'));
              if (!targetSelect) {
                 targetSelect = selects.find(s => Array.from(s.options).some(o => o.text.toLowerCase().includes('oficina')));
              }
              if (targetSelect) {
                  targetSelect.value = val;
                  targetSelect.dispatchEvent(new Event('change', { bubbles: true }));
              }
          }, selectedOffice.value);
      } catch (e: any) {
          // Ignore execution context destroyed errors, which happen if the page navigates
      }

      bot.sendMessage(chatId, `✅ Office selected.`);
      
      // Small delay to allow the next dropdowns (Tramites) to possibly populate via Ajax
      await page.waitForTimeout(2000); 

      bot.sendMessage(chatId, "🔍 Extracting available 'Trámites'...");
      
      let tramites: { text: string; value: string; selectId?: string }[] = [];
      try {
        // Wait for tramites dropdown generically using JS
        await page.waitForFunction(() => {
            const selects = Array.from(document.querySelectorAll('select'));
            return selects.some(s => s.id.toLowerCase().includes('tramite') || s.name.toLowerCase().includes('tramite'));
        }, { timeout: 15000 }).catch(() => {});
        
        tramites = await page.$$eval('select', (selects: HTMLSelectElement[]) => {
          let targetSelects = selects.filter(s => s.id.toLowerCase().includes('tramite') || s.name.toLowerCase().includes('tramite'));
          let allOptions: { text: string; value: string; selectId: string; selectName: string }[] = [];
          
          for (const select of targetSelects) {
            for (const option of select.options) {
              if (option.value !== '' && option.value !== '-1' && !option.text.toLowerCase().includes('despliega para ver')) {
                allOptions.push({
                  text: option.textContent?.trim() || '',
                  value: option.value,
                  selectId: select.id,
                  selectName: select.name
                });
              }
            }
          }
          return allOptions;
        });
      } catch (e: any) {
        bot.sendMessage(chatId, `⚠️ Could not locate the Trámites dropdown. The site might require a different step.\nError: ${e.message}`);
      }

      bot.sendMessage(chatId, "📸 Taking screenshot of the updated form...");
      
      const screenshotBuffer = await page.screenshot({
        timeout: 30000,
        animations: 'disabled',
        type: 'jpeg',
        quality: 40
      });

      if (tramites.length > 0) {
          session.tramites = tramites;
          bot.sendMessage(chatId, `✅ Found ${tramites.length} Trámites.`);
          
          const inlineKeyboard = [];
          for (let i = 0; i < tramites.length; i++) {
            let buttonText = tramites[i].text;
            if (buttonText.length > 60) buttonText = buttonText.substring(0, 57) + "...";
            inlineKeyboard.push([{ text: buttonText, callback_data: `tramite_${i}` }]);
          }

          bot.sendPhoto(chatId, screenshotBuffer, { caption: `✅ Selected Office: ${selectedOffice.text}\n\n📄 Please select a Trámite:`, reply_markup: { inline_keyboard: inlineKeyboard } });
      } else {
          bot.sendPhoto(chatId, screenshotBuffer, { caption: `✅ Selected Office: ${selectedOffice.text}\n⚠️ No Trámites found in the dropdown. Please let me know the next step.` });
      }
      
      await persistSessionState(chatId);

      // Reset timeout
      clearTimeout(session.timeoutId);
      session.timeoutId = setTimeout(() => {
        bot.sendMessage(chatId, "⏳ Session expired due to 10 minutes of inactivity.");
        cleanupSession(chatId);
      }, 10 * 60 * 1000);

    } catch (error: any) {
       bot.sendMessage(chatId, `❌ Error selecting office:\n${error.message}\n\n📸 Taking debug screenshot...`);
       try {
           const errImg = await page.screenshot({ timeout: 15000, type: 'jpeg', quality: 40 });
           bot.sendPhoto(chatId, errImg, { caption: "Debug screenshot of the error state." });
       } catch (e) {}
    }
    return;
  }

  if (data && data.startsWith("tramite_")) {
    const index = parseInt(data.replace("tramite_", ""), 10);
    const session = activeSessions.get(chatId);

    if (!session) {
      bot.sendMessage(chatId, "⚠️ Session expired. Please click 'Launch Cloud Browser' again.");
      bot.answerCallbackQuery(query.id);
      return;
    }

    const { page, tramites } = session;
    const selectedTramite = tramites?.[index];

    if (!selectedTramite) {
       bot.sendMessage(chatId, "⚠️ Invalid Trámite selection.");
       bot.answerCallbackQuery(query.id);
       return;
    }

    if (!userStates.has(chatId)) userStates.set(chatId, {});
    userStates.get(chatId)!.tramite = selectedTramite;

    bot.sendMessage(chatId, `🔄 Selecting Trámite: ${selectedTramite.text}...`);
    bot.answerCallbackQuery(query.id);

    try {
      try {
          if (selectedTramite.selectId) {
              await page.selectOption(`select[id="${selectedTramite.selectId}"]`, selectedTramite.value).catch(() => {});
          } else if (selectedTramite.selectName) {
              await page.selectOption(`select[name="${selectedTramite.selectName}"]`, selectedTramite.value).catch(() => {});
          }
      } catch (e) {}
      
      // Force selection via JS to guarantee it hits the right select element regardless of Playwright locator ambiguity
      try {
          await page.evaluate((val) => {
              const selects = Array.from(document.querySelectorAll('select')).filter(s => s.id.toLowerCase().includes('tramite') || s.name.toLowerCase().includes('tramite'));
              selects.forEach(s => {
                  const selectElem = s as HTMLSelectElement;
                  for (const opt of Array.from(selectElem.options)) {
                      if (opt.value === val) {
                          selectElem.value = val;
                          selectElem.dispatchEvent(new Event('change', { bubbles: true }));
                      }
                  }
              });
          }, selectedTramite.value);
      } catch (e: any) {
          // Ignore execution context destroyed errors
      }
      await page.waitForTimeout(2000);

      bot.sendMessage(chatId, `✅ Trámite selected. Clicking 'Aceptar'...`);

      try {
        const preUrl = page.url();
        const btnSelector = '#btnAceptar, input[value="Aceptar"]';
        
        // Hide potential overlays before click
        await page.evaluate(() => {
            const overlays = document.querySelectorAll('[id*="cookie"], [class*="cookie"], [id*="aviso"], [class*="aviso"]');
            overlays.forEach(o => { (o as HTMLElement).style.display = 'none'; });
        }).catch(() => {});

        await page.waitForTimeout(Math.floor(Math.random() * 2000) + 1500);
        await page.hover(btnSelector).catch(() => {});
        await page.waitForTimeout(Math.floor(Math.random() * 400) + 200);

        await Promise.all([
          page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),
          page.click(btnSelector, { delay: Math.floor(Math.random() * 150) + 50 }).catch(() => {})
        ]);
        
        if (page.url() === preUrl) {
           bot.sendMessage(chatId, "⚠️ URL didn't change native click. Retrying via trusted event...");
           await Promise.all([
             page.waitForNavigation({ waitUntil: 'load', timeout: 45000 }).catch(() => {}),
             page.evaluate((sel: string) => {
                 const el = document.querySelector(sel);
                 if (el) {
                     const evt = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
                     el.dispatchEvent(evt);
                 }
             }, btnSelector).catch(() => {})
           ]);
        }
      } catch (clickErr: any) {
        bot.sendMessage(chatId, `⚠️ Navigation error: ${clickErr.message}`);
      }

      bot.sendMessage(chatId, "⏳ Waiting 10 seconds for the next page to fully render via proxy...");
      await page.waitForTimeout(10000); 

      bot.sendMessage(chatId, "📸 Next page loaded. Taking screenshot...");
      
      const screenshotBuffer = await page.screenshot({
        timeout: 30000,
        animations: 'disabled',
        type: 'jpeg',
        quality: 40
      });

      bot.sendPhoto(chatId, screenshotBuffer, { caption: `✅ Selected Trámite: ${selectedTramite.text}\nHere is the next page.` });
      await persistSessionState(chatId);

      // Reset timeout
      clearTimeout(session.timeoutId);
      session.timeoutId = setTimeout(() => {
        bot.sendMessage(chatId, "⏳ Session expired due to 10 minutes of inactivity.");
        cleanupSession(chatId);
      }, 10 * 60 * 1000);

    } catch (error: any) {
       bot.sendMessage(chatId, `❌ Error moving to next step:\n${error.message}\n\n📸 Taking debug screenshot...`);
       try {
           const errImg = await page.screenshot({ timeout: 15000, type: 'jpeg', quality: 40 });
           bot.sendPhoto(chatId, errImg, { caption: "Debug screenshot of the error state." });
       } catch (e) {}
    }
    return;
  }

  if (data === "gen_week" || data === "gen_month") {
    const duration = data === "gen_week" ? "week" : "month";
    delete pendingDurationForToken[chatId];
    pendingNameForToken[chatId] = { duration };
    bot.sendMessage(
      chatId,
      `Duration selected: ${duration === "week" ? "1 Week" : "1 Month"}. Please enter the name of the person for this token:`,
    );
    bot.answerCallbackQuery(query.id);
    return;
  }

  if (data && data.startsWith("edit_")) {
    const field = data.replace("edit_", "");
    pendingDataField[chatId] = field;
    bot.sendMessage(chatId, `Please enter the new ${field.toUpperCase()}:`);
    bot.answerCallbackQuery(query.id);
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

      bot.sendMessage(chatId, `Machine ${machineId} has been logged out.`);
      bot.answerCallbackQuery(query.id, { text: `Logged out ${machineId}` });
      // Push logout event via WebSocket
      bot.sendMessage(
        chatId,
        `Machine ${machineId} is not currently authorized.`,
      );
      bot.answerCallbackQuery(query.id, { text: `Already logged out` });
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // Serve the static frontend landing page
  app.use(express.static(path.join(process.cwd(), "public")));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  bot.stopPolling();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  bot.stopPolling();
  process.exit(0);
});

loadData().then(() => startServer());
