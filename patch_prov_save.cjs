const fs = require('fs');
let code = fs.readFileSync('src/automation/handleProvinceSelection.ts', 'utf8');

const target = `      if (offices.length > 0) {
          session.offices = offices;
          session.tramites = tramites;
          
          await bot.sendMessage(chatId, \`✅ Found \${offices.length} offices and \${tramites.length} trámites.\`);`;

const replacement = `      // --- DB SAVE INJECTION ---
      try {
          const dbPath = require('path').resolve('./fastmode_db.json');
          const fs = require('fs');
          let db = { provinces: [], offices: {}, tramites: {} };
          if (fs.existsSync(dbPath)) {
              try { db = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch(e){}
          }
          if (offices && offices.length > 0) db.offices[selectedProv.value] = offices;
          if (tramites && tramites.length > 0) db.tramites[selectedProv.value] = tramites;
          fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
      } catch (e) {
          console.error("Failed to save offices/tramites to fast DB", e);
      }
      // -------------------------

      if (offices.length > 0) {
          session.offices = offices;
          session.tramites = tramites;
          
          await bot.sendMessage(chatId, \`✅ Found \${offices.length} offices and \${tramites.length} trámites. (Saved to Database for \${selectedProv.text})\`);`;

const target2 = `      } else if (tramites.length > 0) {
          session.tramites = tramites;
          await bot.sendMessage(chatId, \`✅ Found 0 offices, but \${tramites.length} trámites.\`);`;

const replacement2 = `      } else if (tramites.length > 0) {
          session.tramites = tramites;
          await bot.sendMessage(chatId, \`✅ Found 0 offices, but \${tramites.length} trámites. (Saved to Database for \${selectedProv.text})\`);`;

code = code.replace(target, replacement);
code = code.replace(target2, replacement2);
fs.writeFileSync('src/automation/handleProvinceSelection.ts', code);
console.log("Patched province logic to save DB");
