import "dotenv/config";
import { handleContactInfo } from "./src/automation/handleContactInfo.ts";

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

import { browserQueue } from "./src/queue.ts";
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import * as TelegramBotModule from "node-telegram-bot-api";
import { HttpsProxyAgent } from "https-proxy-agent";
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


import { handleFormFill } from "./src/automation/handleFormFill.ts";
import { handleSubmitForm } from "./src/automation/handleSubmitForm.ts";
import { handleSolicitarCita } from "./src/automation/handleSolicitarCita.ts";

import { handleLaunchBrowser } from "./src/handlers/launchBrowser.ts";
import { handleProvinceSelection } from "./src/automation/handleProvinceSelection.ts";
import { handleOfficeSelection } from "./src/automation/handleOfficeSelection.ts";
import { handleTramiteSelection } from "./src/automation/handleTramiteSelection.ts";
import { initBotContext } from "./src/botContext.ts";
import { claveAuthStates, handleClaveDocument, handleClavePasswordText } from "./src/clave/handleClaveAuth.ts";
import { handleScriptUpload, executeCustomScript } from "./src/handlers/handleCustomScript.ts";

import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// --- ANTI-SLEEP / ANTI-CRASH LOGIC ---
process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception:', err);
    // Keep process alive
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
    // Keep process alive
});

// Periodic ping to keep the event loop and hosting environment awake
const EXTERNAL_URL = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
setInterval(() => {
    console.log('[Heartbeat] Keeping bot awake...', new Date().toISOString());
    if (EXTERNAL_URL) {
        fetch(EXTERNAL_URL + "/api/health").catch(e => console.log("Self-ping failed:", e.message));
    }
}, 5 * 60 * 1000);
// ------------------------------------


// Apply stealth plugin to Playwright
chromium.use(StealthPlugin());

interface UserState {
  province?: { text: string; value: string };
  office?: { text: string; value: string };
  tramite?: { text: string; value: string };
}

const userStates = new Map<number, UserState>();
const autofillState = new Map<number, { step: string, nie?: string, name?: string, queryId?: string }>();
const contactInfoState = new Map<number, { step: string, phone?: string, email?: string, queryId?: string }>();

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


const token = process.env.TELEGRAM_BOT_TOKEN || "8602774350:AAGhaSg22kz85pU8iCFVMkPybc1rhi1gMMw";
const adminChatIds = process.env.TELEGRAM_ADMIN_CHAT_ID
  ? process.env.TELEGRAM_ADMIN_CHAT_ID.split(",").map((s) => s.trim())
  : ["7860277201"];

// TEMPORARY TEST MODE — REMOVE AFTER NORMAL USER FLOW TESTING
// Force the test environment to treat ALL chats as NORMAL USERS (not admin)
const FORCE_NORMAL_USER_MODE = false; // Set to false to restore admin functionality

console.log("[CONFIG] Token loaded:", token.substring(0, 10) + "...");
console.log("[CONFIG] Admin IDs:", adminChatIds);
console.log("[CONFIG] FORCE_NORMAL_USER_MODE:", FORCE_NORMAL_USER_MODE);

// IPRoyal Spanish Proxy Configuration
const PROXY_CONFIG = {
  server: "http://geo.iproyal.com:12321",
  username: "T4Rw8zEYwYOch8Jy",
  password: "Jd2uEOIopKmWukQE_country-es_city-madrid"
};

// Check if running in AI Studio

const EXTERNAL_HOST = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
const useWebhook = !!EXTERNAL_HOST;

// Configure proxy for Telegram bot if needed
const TELEGRAM_PROXY = process.env.TELEGRAM_PROXY; // e.g., "http://proxy:port" or "socks5://proxy:port"
let botOptions: any = { polling: !useWebhook };

if (TELEGRAM_PROXY && !useWebhook) {
    console.log("Configuring Telegram bot to use proxy:", TELEGRAM_PROXY);
    const proxyAgent = new HttpsProxyAgent(TELEGRAM_PROXY);
    botOptions.request = {
        agent: proxyAgent,
    };
}

const bot = new TelegramBot(token, botOptions);
if (!useWebhook) {
    console.log("Starting Telegram Bot in POLLING mode.");
} else {
    console.log("Starting Telegram Bot in WEBHOOK mode. (URL:", EXTERNAL_HOST + ")");
}

initBotContext(bot, activeSessions, userStates, cleanupSession, persistSessionState, PROXY_CONFIG);

const getMainMenu = () => ({
  reply_markup: {
    keyboard: [
      [{ text: "🚀 Fast Auto-Booking (No Browser)" }],
      [{ text: "📂 Draft Profiles" }],
      [{ text: "💾 Admin: Scrape Data (Launch Browser)" }],
    ],
    resize_keyboard: true,
  },
});

const getNormalUserMenu = () => ({
  reply_markup: {
    keyboard: [
      [{ text: "🚀 Fast Auto-Booking (No Browser)" }],
      [{ text: "📂 Draft Profiles" }],
    ],
    resize_keyboard: true,
  },
});

// Webhook routing will be set up in startServer

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
  // TEMPORARY TEST MODE — REMOVE AFTER NORMAL USER FLOW TESTING
  const isAdmin = FORCE_NORMAL_USER_MODE ? false : adminChatIds.includes(chatId.toString());

  if (!isAdmin) {
    bot.sendMessage(chatId, "Main Menu:", getNormalUserMenu());
    return;
  }

  bot.sendMessage(chatId, "Main Menu:", getMainMenu());
});

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  // TEMPORARY TEST MODE — REMOVE AFTER NORMAL USER FLOW TESTING
  const isAdmin = FORCE_NORMAL_USER_MODE ? false : adminChatIds.includes(chatId.toString());

  console.log(`[/start] chatId=${chatId} isAdmin=${isAdmin}`);

  if (!isAdmin) {
    // Normal user flow - provide menu with available features
    const menu = getNormalUserMenu();
    console.log(`[/start] Sending normal user menu to ${chatId}`);
    console.log(`[/start] Menu object:`, JSON.stringify(menu, null, 2));
    bot.sendMessage(
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
  bot.sendMessage(
    chatId,
    "Welcome Admin! Please select an option:",
    getMainMenu(),
  ).then(() => {
    console.log(`[/start] Admin message sent successfully to ${chatId}`);
  }).catch((err) => {
    console.error(`[/start] Error sending admin message to ${chatId}:`, err);
  });
});

bot.onText(/\/logout_(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  // TEMPORARY TEST MODE — REMOVE AFTER NORMAL USER FLOW TESTING
  const isAdmin = FORCE_NORMAL_USER_MODE ? false : adminChatIds.includes(chatId.toString());
  if (!isAdmin) return;
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

  console.log(`[MSG] chatId=${chatId} text="${text}" admins=${JSON.stringify(adminChatIds)}`);

  // TEMPORARY TEST MODE — REMOVE AFTER NORMAL USER FLOW TESTING
  const isAdmin = FORCE_NORMAL_USER_MODE ? false : adminChatIds.includes(chatId.toString());

  if (!text) return;

  // Skip commands that have dedicated onText handlers to prevent duplicate processing
  if (text.startsWith('/start') || text.startsWith('/menu') || text.startsWith('/logout_')) {
    return;
  }

  // Allow non-admin users through, but skip admin-only commands
  if (!isAdmin) {
    // Admin-only commands that should be blocked for normal users
    const adminOnlyCommands = [
      "💾 Admin: Scrape Data (Launch Browser)",
      "gen token",
      "token history",
      "user list",
      "set phone",
      "set email"
    ];

    if (adminOnlyCommands.some(cmd => text.startsWith(cmd))) {
      return; // Silently ignore admin commands from non-admin users
    }

    // Allow normal user features to continue
  } else {
    // Admin user - allow everything
  }

  if (claveAuthStates.has(chatId)) {
    const handled = await handleClavePasswordText(chatId, text);
    if (handled) return;
  }

  if (autofillState.has(chatId)) {
    const state = autofillState.get(chatId);
    if (state.step === 'awaiting_nie') {
        state.nie = text.trim();
        state.step = 'awaiting_name';
        bot.sendMessage(chatId, "📝 Please reply with the full Name/Apellidos:");
        return;
    }
    if (state.step === 'awaiting_name') {
        state.name = text.trim();
        autofillState.delete(chatId);
        
        bot.sendMessage(chatId, "⏳ Processing...");
        await handleFormFill(chatId, state.queryId || '', state.nie, state.name);
        return;
    }
  }

  if (contactInfoState.has(chatId)) {
    const state = contactInfoState.get(chatId);
    if (state.step === 'awaiting_phone') {
        state.phone = text.trim();
        state.step = 'awaiting_email';
        bot.sendMessage(chatId, "📝 Please reply with your Email Address:");
        return;
    }
    if (state.step === 'awaiting_email') {
        state.email = text.trim();
        contactInfoState.delete(chatId);
        
        bot.sendMessage(chatId, "⏳ Processing Contact Info...");
        await handleContactInfo(chatId, state.queryId || '', state.phone, state.email);
        return;
    }
  }


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

  if (text === "💾 Admin: Scrape Data (Launch Browser)") {
    browserQueue.enqueue(async () => {
        await handleLaunchBrowser(chatId);
    }, (pos: number) => {
        bot.sendMessage(chatId, `⏳ You are in queue (Position: ${pos}). Please wait, your browser will launch automatically when it's your turn...`);
    });
    return;
  }

  // Hook up Fast Chat text intercept (for NIE, Name, etc)
  try {
     const fastChat = await import('./src/fastmode/fastChatMenu.js');
     if (fastChat.handleFastChatText(bot, chatId, text)) return;
  } catch(e) {}

  // Hook up Fast Chat initiation
  if (text === "🚀 Fast Auto-Booking (No Browser)") {
     import('./src/fastmode/fastChatMenu.js').then(module => {
         module.startFastChat(bot, chatId);
     }).catch(err => {
         console.error(err);
         bot.sendMessage(chatId, "⚠️ Fast mode module is not compiled or missing.");
     });
     return;
  }

  // Hook up Draft Profiles
  if (text === "📂 Draft Profiles" || text === "/profiles" || text === "/drafts") {
     import('./src/fastmode/fastChatMenu.js').then(module => {
         module.showDraftProfiles(bot, chatId);
     }).catch(err => {
         console.error(err);
         bot.sendMessage(chatId, "⚠️ Fast mode module is not compiled or missing.");
     });
     return;
  }

  // --- TEST CALENDAR COMMAND ---
  if (text === "/test_calendar") {
     import('./src/automation/dateCalendarMenu.ts').then(module => {
         module.sendDateSelectionMenu(bot, chatId);
     }).catch(err => console.error(err));
     return;
  }
  // -----------------------------

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

bot.on("document", async (msg) => {
  const chatId = msg.chat.id;
  // TEMPORARY TEST MODE — REMOVE AFTER NORMAL USER FLOW TESTING
  const isAdmin = FORCE_NORMAL_USER_MODE ? false : adminChatIds.includes(chatId.toString());

  const doc = msg.document;
  if (!doc) return;

  const fileName = doc.file_name || "";
  const ext = fileName.toLowerCase();

  // Admin: Custom extraction script upload (.js or .mjs)
  if (isAdmin && (ext.endsWith(".js") || ext.endsWith(".mjs"))) {
    try {
      const fileLink = await bot.getFileLink(doc.file_id);
      const response = await fetch(fileLink);
      if (!response.ok) throw new Error("Failed to download file");
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await handleScriptUpload(chatId, fileName, buffer);
    } catch (err: any) {
      await bot.sendMessage(chatId, `❌ Error downloading file: ${err.message}`);
    }
    return;
  }

  // Normal users: Cl@ve authentication (.p12)
  if (!claveAuthStates.has(chatId)) return;

  if (!ext.endsWith(".p12")) {
    await bot.sendMessage(chatId, "⚠️ Please upload a `.p12` file.", { parse_mode: "Markdown" });
    return;
  }

  try {
    const fileLink = await bot.getFileLink(doc.file_id);
    const response = await fetch(fileLink);
    if (!response.ok) throw new Error("Failed to download file");
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await handleClaveDocument(chatId, fileName, buffer);
  } catch (err: any) {
    await bot.sendMessage(chatId, `❌ Error downloading file: ${err.message}`);
  }
});

bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat.id;
  if (!chatId) return;

  // TEMPORARY TEST MODE — REMOVE AFTER NORMAL USER FLOW TESTING
  const isAdmin = FORCE_NORMAL_USER_MODE ? false : adminChatIds.includes(chatId.toString());

  const data = query.data;

  // Allow non-admin users through, but block admin-only callbacks
  if (!isAdmin) {
    // Admin-only callback patterns
    const adminOnlyPatterns = ["gen_week", "gen_month", "edit_", "logout_"];
    if (data && adminOnlyPatterns.some(pattern => data.startsWith(pattern))) {
      return; // Silently ignore admin callbacks from non-admin users
    }
    // Allow normal user callbacks to continue
  }

  // Fast chat intercept
  if (data) {
      try {
          const fastChat = await import('./src/fastmode/fastChatMenu.js');
          if (fastChat.handleFastChatCallback(bot, chatId, data, query.id, query.message?.message_id)) return;
      } catch(e) {}
      
      // Test Calendar Intercept
      try {
          const calMenu = await import('./src/automation/dateCalendarMenu.ts');
          if (await calMenu.handleDateCalendarCallback(bot, chatId, data, query.id, query.message?.message_id)) return;
      } catch(e) {}
  }
  
  if (data === "close_browser") {
      cleanupSession(chatId);
      bot.sendMessage(chatId, "🛑 Browser session closed successfully. MBs saved!");
      bot.answerCallbackQuery(query.id);
      return;
  }

  // Admin: Run custom extraction script
  if (data === "run_custom_extraction") {
      if (!isAdmin) {
          bot.answerCallbackQuery(query.id);
          return;
      }
      bot.answerCallbackQuery(query.id);
      await executeCustomScript(chatId);
      return;
  }

  if (data && data.startsWith("dyn_")) {
    const index = parseInt(data.replace("dyn_", ""), 10);
    const { handleDynamicClick } = await import('./src/automation/handleDynamicClick.js');
    await handleDynamicClick(chatId, query.id, index);
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
    autofillState.set(chatId, { step: 'awaiting_nie', queryId: query.id });
    bot.sendMessage(chatId, "📝 Please reply with the NIE/DNI:");
    bot.answerCallbackQuery(query.id);
    return;
  }

  if (data === "fill_contact") {
    contactInfoState.set(chatId, { step: 'awaiting_phone', queryId: query.id });
    bot.sendMessage(chatId, "📝 Please reply with your Phone Number:");
    bot.answerCallbackQuery(query.id);
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

  app.use(express.json());

  // Serve the static frontend landing page
  app.use(express.static(path.join(process.cwd(), "public")));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: useWebhook ? "webhook" : "polling" });
  });

  if (useWebhook) {
      const webhookPath = "/bot" + token;
      const webhookUrl = EXTERNAL_HOST + webhookPath;
      
      app.post(webhookPath, (req, res) => {
          bot.processUpdate(req.body);
          res.sendStatus(200);
      });
      
      try {
          let success = false;
          for (let i = 0; i < 3; i++) {
              try {
                  await bot.setWebHook(webhookUrl);
                  console.log("✅ Webhook successfully set to:", webhookUrl);
                  success = true;
                  break;
              } catch (e) {
                  console.log(`Webhook attempt ${i+1} failed...`);
                  await new Promise(r => setTimeout(r, 2000));
              }
          }
          if (!success) {
              console.error("❌ Failed to set webhook after 3 attempts. Falling back to POLLING.");
              bot.startPolling();
          }
      } catch (e) {
          console.error("❌ Error in webhook setup:", e);
          bot.startPolling();
      }
  } else {
      // Ensure webhook is removed if we fallback to polling
      try {
          await bot.deleteWebHook();
      } catch(e) {}
  }

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
