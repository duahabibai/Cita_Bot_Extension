const fs = require('fs');

function replaceWithRegex(file, pattern, replacement) {
    if(!fs.existsSync(file)) return;
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(pattern, replacement);
    fs.writeFileSync(file, code);
}

replaceWithRegex('src/automation/handleOfficeSelection.ts', /await bot\.sendPhoto\(chatId, screenshotBuffer, \{ caption: `✅ Selected Office: \$\{selectedOffice\.text\}\\n\\n📄 Please select a Trámite:`, reply_markup: \{ inline_keyboard: inlineKeyboard \} \}\);/g, `await bot.sendMessage(chatId, \`✅ Selected Office: \$\{selectedOffice.text\}\\n\\n📄 Please select a Trámite:\`, { reply_markup: { inline_keyboard: inlineKeyboard } });`);
replaceWithRegex('src/automation/handleTramiteSelection.ts', /await bot\.sendPhoto\(chatId, screenshotBuffer, \{\s*caption: `✅ Selected Trámite: \$\{selectedTramite\.text\}\\n\\nHere is the next page\. If there is a form, please click "Fill Form"\.`,\s*reply_markup: \{\s*inline_keyboard: \[\[\{ text: "📝 Fill Form", callback_data: "autofill_form" \}\]\]\s*\}\s*\}\);/g, `await bot.sendMessage(chatId, \`✅ Selected Trámite: \$\{selectedTramite.text\}\\n\\nHere is the next page. If there is a form, please click "Fill Form".\`, {\n          reply_markup: {\n             inline_keyboard: [[{ text: "📝 Fill Form", callback_data: "autofill_form" }]]\n          }\n      });`);

