const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const menuTarget = `const getMainMenu = () => ({
  reply_markup: {
    keyboard: [
      [{ text: "Launch Cloud Browser" }],
    ],
    resize_keyboard: true,
  },
});`;

const menuReplacement = `const getMainMenu = () => ({
  reply_markup: {
    keyboard: [
      [{ text: "🚀 Fast Auto-Booking (No Browser)" }],
      [{ text: "💾 Admin: Scrape Data (Launch Browser)" }],
    ],
    resize_keyboard: true,
  },
});`;

code = code.replace(menuTarget, menuReplacement);

const launchTarget = `  if (text === "Launch Cloud Browser") {
    browserQueue.enqueue(async () => {
        await handleLaunchBrowser(chatId);
    }, (pos: number) => {
        bot.sendMessage(chatId, \`⏳ You are in queue (Position: \${pos}). Please wait, your browser will launch automatically when it's your turn...\`);
    });
    return;
  }`;

const launchReplacement = `  if (text === "💾 Admin: Scrape Data (Launch Browser)") {
    browserQueue.enqueue(async () => {
        await handleLaunchBrowser(chatId);
    }, (pos: number) => {
        bot.sendMessage(chatId, \`⏳ You are in queue (Position: \${pos}). Please wait, your browser will launch automatically when it's your turn...\`);
    });
    return;
  }

  // Hook up Fast Chat initiation
  if (text === "🚀 Fast Auto-Booking (No Browser)") {
     import('./src/fastmode/fastChatMenu.js').then(module => {
         module.startFastChat(bot, chatId);
     }).catch(err => {
         console.error(err);
         bot.sendMessage(chatId, "⚠️ Fast mode module is not compiled or missing.");
     });
     return;
  }`;

code = code.replace(launchTarget, launchReplacement);

// We also need to inject fastChat handlers at the start of bot.on('message') and bot.on('callback_query')

const onMessageTarget = `bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || !adminChatIds.includes(chatId.toString())) return;`;

const onMessageReplacement = `bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || !adminChatIds.includes(chatId.toString())) return;
  
  // Fast chat intercept
  try {
      const fastChat = await import('./src/fastmode/fastChatMenu.js');
      if (fastChat.handleFastChatText(bot, chatId, text)) return;
  } catch(e) {}`;

code = code.replace(onMessageTarget, onMessageReplacement);

const onCallbackTarget = `bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat.id;
  if (!chatId || !adminChatIds.includes(chatId.toString())) return;
  const data = query.data;`;

const onCallbackReplacement = `bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat.id;
  if (!chatId || !adminChatIds.includes(chatId.toString())) return;
  const data = query.data;

  // Fast chat intercept
  if (data) {
      try {
          const fastChat = await import('./src/fastmode/fastChatMenu.js');
          if (fastChat.handleFastChatCallback(bot, chatId, data, query.id)) return;
      } catch(e) {}
  }`;

code = code.replace(onCallbackTarget, onCallbackReplacement);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts with Fast Mode menu and handlers");
