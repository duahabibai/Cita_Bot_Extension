const fs = require('fs');
let code = fs.readFileSync('src/fastmode/fastChatMenu.ts', 'utf8');

// 1. Fix startFastChat to ALWAYS reset state properly
const targetStart = `export function startFastChat(bot: TelegramBot, chatId: number) {
    const db = loadFastDb();
    if (db.provinces.length === 0) {
        bot.sendMessage(chatId, "⚠️ Database is empty. Admin needs to scrape provinces first using '💾 Admin: Scrape Data'.");
        return;
    }
    
    fastBookingStates.set(chatId, { step: 'province' });`;

const replacementStart = `export function startFastChat(bot: TelegramBot, chatId: number) {
    // ALWAYS reset state when starting fresh
    fastBookingStates.delete(chatId);
    
    const db = loadFastDb();
    if (db.provinces.length === 0) {
        bot.sendMessage(chatId, "⚠️ Database is empty. Admin needs to scrape provinces first using '💾 Admin: Scrape Data'.");
        return;
    }
    
    fastBookingStates.set(chatId, { step: 'province' });`;
    
code = code.replace(targetStart, replacementStart);

// 2. Fix the Tramite array length bug (sometimes tramites are saved as object keys instead of an array depending on how JS parsed it, 
// or simply the property is missing. We will ensure it reads properly).
const targetOff = `        if (office) {
            state.office = office;
            state.step = 'tramite';
            const tramites = db.tramites[provVal] || [];
            const kb = tramites.map(t => ([{ text: t.text.substring(0,60), callback_data: \`fm_tra_\${t.value}\` }]));
            
            if (kb.length > 0) {`;

const replacementOff = `        if (office) {
            state.office = office;
            state.step = 'tramite';
            
            // Fix: ensure tramites is an array even if parsed weirdly
            let tramites = db.tramites[provVal] || [];
            if (!Array.isArray(tramites)) {
                tramites = Object.values(tramites);
            }
            
            // If the tramites array has elements, build the keyboard
            const kb = tramites.map(t => ([{ text: t.text.substring(0,60), callback_data: \`fm_tra_\${t.value}\` }]));
            
            if (kb.length > 0) {`;

code = code.replace(targetOff, replacementOff);

fs.writeFileSync('src/fastmode/fastChatMenu.ts', code);
console.log("Patched fastChatMenu for state reset and tramite array fix.");
