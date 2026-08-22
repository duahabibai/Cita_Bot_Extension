const fs = require('fs');

function replaceWithRegex(file, pattern, replacement) {
    if(!fs.existsSync(file)) return;
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(pattern, replacement);
    fs.writeFileSync(file, code);
}

// 1. launchBrowser.ts
replaceWithRegex('src/handlers/launchBrowser.ts', /const screenshotBuffer = await page\.screenshot\(\{ timeout: 30000, type: 'jpeg', quality: 40 \}\);\s*await bot\.sendPhoto\(chatId, screenshotBuffer, \{ caption: "Here is the current screen." \}\);/g, `await bot.sendMessage(chatId, "📍 Province page loaded successfully!");`);

// 2. handleProvinceSelection.ts
replaceWithRegex('src/automation/handleProvinceSelection.ts', /const screenshotBuffer = await page\.screenshot\([\s\S]*?\);\s*await bot\.sendPhoto\(chatId, screenshotBuffer, \{ caption: `✅ Selected Province: \$\{selectedProv\.text\}\\n\\n📄 No specific office dropdown\. Please select a Trámite:`, reply_markup: \{ inline_keyboard: inlineKeyboard \} \}\);/g, `await bot.sendMessage(chatId, \`✅ Selected Province: \$\{selectedProv.text\}\\n\\n📄 No specific office dropdown. Please select a Trámite:\`, { reply_markup: { inline_keyboard: inlineKeyboard } });`);

replaceWithRegex('src/automation/handleProvinceSelection.ts', /await bot\.sendPhoto\(chatId, screenshotBuffer, \{ caption: `✅ Selected Province: \$\{selectedProv\.text\}\\n⚠️ No offices or trámites found on this page\. The layout might be different\.` \}\);/g, `await bot.sendMessage(chatId, \`✅ Selected Province: \$\{selectedProv.text\}\\n⚠️ No offices or trámites found on this page. The layout might be different.\`);`);

// 3. handleTramiteSelection.ts
replaceWithRegex('src/automation/handleTramiteSelection.ts', /const screenshotBuffer = await page\.screenshot\([\s\S]*?\);\s*await bot\.sendPhoto\(chatId, screenshotBuffer, \{\s*caption: `✅ Selected Trámite: \$\{selectedTramite\.text\}\\n\\nHere is the next page\. If there is a form, please click "Fill Form"\.`,\s*reply_markup: \{\s*inline_keyboard: \[\[\{ text: "📝 Fill Form", callback_data: "autofill_form" \}\]\]\s*\}\s*\}\);/g, `await bot.sendMessage(chatId, \`✅ Selected Trámite: \$\{selectedTramite.text\}\\n\\nHere is the next page. If there is a form, please click "Fill Form".\`, {\n          reply_markup: {\n             inline_keyboard: [[{ text: "📝 Fill Form", callback_data: "autofill_form" }]]\n          }\n      });`);

// 4. handleFormFill.ts
replaceWithRegex('src/automation/handleFormFill.ts', /const screenshotBuffer = await page\.screenshot\([\s\S]*?\);\s*await bot\.sendPhoto\(chatId, screenshotBuffer, \{ caption: "✅ Form submitted successfully\. \(Page 5\)" \}\);/g, `await bot.sendMessage(chatId, "✅ Form submitted successfully. (Page 5)");`);

// 5. handleAutoOfficeSelection.ts
replaceWithRegex('src/automation/handleAutoOfficeSelection.ts', /const finalScreenshot = await page\.screenshot\([\s\S]*?\);\s*await bot\.sendPhoto\(chatId, finalScreenshot, \{\s*caption: "✅ Office selected successfully\. Here is the new page!",\s*reply_markup: \{\s*inline_keyboard: \[\[\{ text: "📝 Fill Phone & Email", callback_data: "fill_contact" \}\]\]\s*\}\s*\}\);/g, `await bot.sendMessage(chatId, "✅ Office selected successfully. Reached Contact Info Page!", { \n                reply_markup: {\n                    inline_keyboard: [[{ text: "📝 Fill Phone & Email", callback_data: "fill_contact" }]]\n                }\n            });`);

replaceWithRegex('src/automation/handleAutoOfficeSelection.ts', /const fallbackScreenshot = await page\.screenshot\([\s\S]*?\);\s*await bot\.sendPhoto\(chatId, fallbackScreenshot, \{ caption: "🔙 Returned to Form Page via Fallback\." \}\);/g, `await bot.sendMessage(chatId, "🔙 Returned to Form Page via Fallback.");`);

console.log("Regex replacement done.");
