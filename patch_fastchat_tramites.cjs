const fs = require('fs');
let code = fs.readFileSync('src/fastmode/fastChatMenu.ts', 'utf8');

const target = `        if (office) {
            state.office = office;
            state.step = 'tramite';
            
            // Fix: ensure tramites is an array even if parsed weirdly
            let tramites = db.tramites[provVal] || [];
            if (!Array.isArray(tramites)) {
                tramites = Object.values(tramites);
            }
            
            // If the tramites array has elements, build the keyboard
            const kb = tramites.map(t => ([{ text: t.text.substring(0,60), callback_data: \`fm_tra_\${t.value}\` }]));
            
            if (kb.length > 0) {
                sendOrEdit(\`🏢 Selected Office: \${office.text}\\n\\nSelect Tramite:\`, { inline_keyboard: kb });
            } else {
                // Skip tramite if none saved
                state.step = 'nie';
                sendOrEdit("📝 No tramites saved. Please reply with NIE/DNI:");
            }
        }`;

const replacement = `        if (office) {
            state.office = office;
            state.step = 'tramite';
            
            // Fix: ensure tramites is an array even if parsed weirdly
            let tramites = db.tramites[provVal] || [];
            
            // Fallback: If DB doesn't have tramites under provVal directly, try to search globally (some sites change keys)
            if (tramites.length === 0) {
                for (const key in db.tramites) {
                    if (key.includes(provVal.split('&')[0])) {
                        tramites = db.tramites[key];
                        break;
                    }
                }
            }
            
            if (!Array.isArray(tramites)) {
                tramites = Object.values(tramites);
            }
            
            console.log("Found tramites for province:", provVal, tramites.length);
            
            // If the tramites array has elements, build the keyboard
            const kb = tramites.map(t => ([{ text: t.text.substring(0,60), callback_data: \`fm_tra_\${t.value}\` }]));
            
            if (kb.length > 0) {
                sendOrEdit(\`🏢 Selected Office: \${office.text}\\n\\nSelect Tramite:\`, { inline_keyboard: kb });
            } else {
                // Skip tramite if none saved
                state.step = 'nie';
                sendOrEdit("📝 No tramites saved in database for this province! Admin needs to scrape it. Please reply with NIE/DNI anyway to bypass:");
            }
        }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/fastmode/fastChatMenu.ts', code);
console.log("Patched fastChatMenu.ts");
