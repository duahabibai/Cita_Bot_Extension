const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || !adminChatIds.includes(chatId.toString())) return;`;

const replacement = `bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || !adminChatIds.includes(chatId.toString())) return;
  console.log("RECEIVED TEXT MESSAGE:", text);`;

code = code.replace(target, replacement);

fs.writeFileSync('server.ts', code);
