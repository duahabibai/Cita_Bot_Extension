const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `  // Hook up Fast Chat initiation
  if (text === "🚀 Fast Auto-Booking (No Browser)") {`;

const replacement = `  // Hook up Fast Chat text intercept (for NIE, Name, etc)
  try {
     const fastChat = await import('./src/fastmode/fastChatMenu.js');
     if (fastChat.handleFastChatText(bot, chatId, text)) return;
  } catch(e) {}

  // Hook up Fast Chat initiation
  if (text === "🚀 Fast Auto-Booking (No Browser)") {`;

code = code.replace(target, replacement);

fs.writeFileSync('server.ts', code);
