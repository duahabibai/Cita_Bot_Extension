const fs = require('fs');
let code = fs.readFileSync('src/handlers/launchBrowser.ts', 'utf8');

const target = `    if (provinces && provinces.length > 0) {
       await bot.sendMessage(chatId, \`✅ Found \${provinces.length} provinces.\`);`;

const replacement = `    if (provinces && provinces.length > 0) {
       // --- DB SAVE INJECTION ---
       try {
           const dbPath = require('path').resolve('./fastmode_db.json');
           const fs = require('fs');
           let db = { provinces: [], offices: {}, tramites: {} };
           if (fs.existsSync(dbPath)) {
               try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch(e){}
           }
           db.provinces = provinces;
           fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
       } catch (e) {
           console.error("Failed to save provinces to fast DB", e);
       }
       // -------------------------

       await bot.sendMessage(chatId, \`✅ Found \${provinces.length} provinces. (Saved to Database)\`);`;

code = code.replace(target, replacement);
fs.writeFileSync('src/handlers/launchBrowser.ts', code);
console.log("Patched launchBrowser to save DB");
