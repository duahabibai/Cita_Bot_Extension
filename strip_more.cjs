const fs = require('fs');

function replaceWithRegex(file, pattern, replacement) {
    if(!fs.existsSync(file)) return;
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(pattern, replacement);
    fs.writeFileSync(file, code);
}

replaceWithRegex('src/automation/handleOfficeSelection.ts', /const screenshotBuffer = await page\.screenshot\([\s\S]*?\);\s*await bot\.sendPhoto\(chatId, screenshotBuffer, \{ caption: `✅ Selected Office: \$\{selectedOffice\.text\}\\n\\n📄 Please select a Trámite:`, reply_markup: \{ inline_keyboard: inlineKeyboard \} \}\);/g, `await bot.sendMessage(chatId, \`✅ Selected Office: \$\{selectedOffice.text\}\\n\\n📄 Please select a Trámite:\`, { reply_markup: { inline_keyboard: inlineKeyboard } });`);

replaceWithRegex('src/automation/handleOfficeSelection.ts', /await bot\.sendPhoto\(chatId, screenshotBuffer, \{ caption: `✅ Selected Office: \$\{selectedOffice\.text\}\\n⚠️ No Trámites found in the dropdown\. Please let me know the next step\.` \}\);/g, `await bot.sendMessage(chatId, \`✅ Selected Office: \$\{selectedOffice.text\}\\n⚠️ No Trámites found in the dropdown. Please let me know the next step.\`);`);

replaceWithRegex('src/automation/handleSubmitForm.ts', /const screenshotBuffer = await page\.screenshot\([\s\S]*?\);\s*await bot\.sendPhoto\(chatId, screenshotBuffer, \{ caption: `✅ Form submitted\. Here is the next step\.` \}\);/g, `await bot.sendMessage(chatId, \`✅ Form submitted. Here is the next step.\`);`);

replaceWithRegex('src/automation/handleSolicitarCita.ts', /const nextScreenshot = await page\.screenshot\([\s\S]*?\);\s*await bot\.sendPhoto\(chatId, nextScreenshot, \{ caption: "✅ 'Solicitar Cita' clicked successfully\. Here is the new page!" \}\);/g, `await bot.sendMessage(chatId, "✅ 'Solicitar Cita' clicked successfully. Here is the new page!");`);

console.log("Stripped more successfully.");
