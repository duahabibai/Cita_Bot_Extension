const fs = require('fs');
let code = fs.readFileSync('src/fastmode/fastChatMenu.ts', 'utf8');

code = code.replace(/export function handleFastChatCallback\(bot: TelegramBot, chatId: number, data: string, queryId: string, messageId\?: number\) \{/, 
`export function handleFastChatCallback(bot: TelegramBot, chatId: number, data: string, queryId: string, messageId?: number) {
    console.log("FASTCHAT CALLBACK RECEIVED:", { chatId, data, queryId, messageId });`);

code = code.replace(/export function startFastChat\(bot: TelegramBot, chatId: number\) \{/,
`export function startFastChat(bot: TelegramBot, chatId: number) {
    console.log("START FAST CHAT CALLED FOR:", chatId);`);
    
fs.writeFileSync('src/fastmode/fastChatMenu.ts', code);
