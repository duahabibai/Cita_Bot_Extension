const fs = require('fs');
let code = fs.readFileSync('src/fastmode/fastChatMenu.ts', 'utf8');

const target = `            if (offices.length > 0) {
                state.step = 'office';
                const kb = offices.map(o => ([{ text: o.text.substring(0,60), callback_data: \`fm_off_\${o.value}\` }]));
                sendOrEdit(\`🏢 Selected Province: \${prov.text}\\n\\nSelect Office:\`, { inline_keyboard: kb });
            } else if (tramites.length > 0) {
                state.step = 'tramite';
                const kb = tramites.map(t => ([{ text: t.text.substring(0,60), callback_data: \`fm_tra_\${t.value}\` }]));
                sendOrEdit(\`📄 Selected Province: \${prov.text}\\nNo offices found. Select Tramite:\`, { inline_keyboard: kb });
            } else {
                sendOrEdit(\`⚠️ No offices or tramites saved in database for \${prov.text}. Admin needs to scrape it first.\`);
                fastBookingStates.delete(chatId);
            }`;

const replacement = `            if (offices.length > 0) {
                state.step = 'office';
                const kb = offices.map(o => ([{ text: o.text.substring(0,60), callback_data: \`fm_off_\${o.value}\` }]));
                sendOrEdit(\`🏢 Selected Province: \${prov.text}\\n\\nSelect Office:\`, { inline_keyboard: kb });
            } else if (tramites.length > 0) {
                state.step = 'tramite';
                const kb = tramites.map(t => ([{ text: t.text.substring(0,60), callback_data: \`fm_tra_\${t.value}\` }]));
                sendOrEdit(\`📄 Selected Province: \${prov.text}\\nNo offices found. Select Tramite:\`, { inline_keyboard: kb });
            } else {
                state.step = 'nie';
                sendOrEdit(\`⚠️ No offices or tramites saved in database for \${prov.text}. Proceeding anyway.\\n\\n📝 Please reply with NIE/DNI:\`);
            }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/fastmode/fastChatMenu.ts', code);
console.log("Patched fastChatMenu.ts part 2");
