const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace the naive setInterval with a self-pinging HTTP request
const oldPing = `// Periodic ping to keep the event loop and hosting environment awake
setInterval(() => {
    console.log('[Heartbeat] Keeping bot awake...', new Date().toISOString());
}, 5 * 60 * 1000);`;

const newPing = `// Periodic ping to keep the event loop and hosting environment awake
const EXTERNAL_URL = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
setInterval(() => {
    console.log('[Heartbeat] Keeping bot awake...', new Date().toISOString());
    if (EXTERNAL_URL) {
        fetch(EXTERNAL_URL + "/api/health").catch(e => console.log("Self-ping failed:", e.message));
    }
}, 5 * 60 * 1000);`;

code = code.replace(oldPing, newPing);

// Fix Telegram polling vs webhook logic
// We'll replace the bot initialization and startServer logic.

// 1. We replace the top level Telegram bot creation to default to polling unless WEBHOOK_URL is clearly defined.
const oldBotInit = `const isAIStudio =
  process.env.APP_URL &&
  (process.env.APP_URL.includes("ais-dev") ||
    process.env.APP_URL.includes("ais-pre"));

const bot = new TelegramBot(token, { polling: !isAIStudio });`;

const newBotInit = `
const EXTERNAL_HOST = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
const useWebhook = !!EXTERNAL_HOST;

const bot = new TelegramBot(token, { polling: !useWebhook });
if (!useWebhook) {
    console.log("Starting Telegram Bot in POLLING mode.");
} else {
    console.log("Starting Telegram Bot in WEBHOOK mode. (URL:", EXTERNAL_HOST + ")");
}
`;

code = code.replace(oldBotInit, newBotInit);

const oldIsAIStudioLog = `if (isAIStudio) {
  console.log(
    "⚠️ Telegram polling is DISABLED in AI Studio to prevent 409 conflicts with Render.",
  );
}`;
code = code.replace(oldIsAIStudioLog, `// Webhook routing will be set up in startServer`);


const oldStartServer = `async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // Serve the static frontend landing page
  app.use(express.static(path.join(process.cwd(), "public")));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });
}`;

const newStartServer = `async function startServer() {
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
          await bot.setWebHook(webhookUrl);
          console.log("✅ Webhook successfully set to:", webhookUrl);
      } catch (e) {
          console.error("❌ Failed to set webhook:", e);
      }
  } else {
      // Ensure webhook is removed if we fallback to polling
      try {
          await bot.deleteWebHook();
      } catch(e) {}
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(\`Server running on http://localhost:\${PORT}\`);
  });
}`;

code = code.replace(oldStartServer, newStartServer);

fs.writeFileSync('server.ts', code);
console.log("Patched sleep logic");
