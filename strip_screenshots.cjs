const fs = require('fs');

function replaceInFile(file, replacements) {
    if(!fs.existsSync(file)) return;
    let code = fs.readFileSync(file, 'utf8');
    for (const {target, replacement} of replacements) {
        code = code.replace(target, replacement);
    }
    fs.writeFileSync(file, code);
}

// 1. launchBrowser.ts
replaceInFile('src/handlers/launchBrowser.ts', [
    {
        target: `const screenshotBuffer = await page.screenshot({ timeout: 30000, type: 'jpeg', quality: 40 });
       await bot.sendPhoto(chatId, screenshotBuffer, { caption: "Here is the current screen." });`,
        replacement: `await bot.sendMessage(chatId, "📍 Province page loaded successfully!");`
    }
]);

// 2. handleProvinceSelection.ts
replaceInFile('src/automation/handleProvinceSelection.ts', [
    {
        target: `const screenshotBuffer = await page.screenshot({ timeout: 30000, type: 'jpeg', quality: 40 });`,
        replacement: ``
    },
    {
        target: `await bot.sendPhoto(chatId, screenshotBuffer, { caption: \`✅ Selected Province: \${selectedProv.text}\\n\\n📄 No specific office dropdown. Please select a Trámite:\`, reply_markup: { inline_keyboard: inlineKeyboard } });`,
        replacement: `await bot.sendMessage(chatId, \`✅ Selected Province: \${selectedProv.text}\\n\\n📄 No specific office dropdown. Please select a Trámite:\`, { reply_markup: { inline_keyboard: inlineKeyboard } });`
    },
    {
        target: `await bot.sendPhoto(chatId, screenshotBuffer, { caption: \`✅ Selected Province: \${selectedProv.text}\\n⚠️ No offices or trámites found on this page. The layout might be different.\` });`,
        replacement: `await bot.sendMessage(chatId, \`✅ Selected Province: \${selectedProv.text}\\n⚠️ No offices or trámites found on this page. The layout might be different.\`);`
    }
]);

// 3. handleTramiteSelection.ts
replaceInFile('src/automation/handleTramiteSelection.ts', [
    {
        target: `const screenshotBuffer = await page.screenshot({ timeout: 30000, type: 'jpeg', quality: 40 });`,
        replacement: ``
    },
    {
        target: `await bot.sendPhoto(chatId, screenshotBuffer, { 
          caption: \`✅ Selected Trámite: \${selectedTramite.text}\\n\\nHere is the next page. If there is a form, please click "Fill Form".\`,
          reply_markup: {
             inline_keyboard: [[{ text: "📝 Fill Form", callback_data: "autofill_form" }]]
          }
      });`,
        replacement: `await bot.sendMessage(chatId, \`✅ Selected Trámite: \${selectedTramite.text}\\n\\nHere is the next page. If there is a form, please click "Fill Form".\`, { 
          reply_markup: {
             inline_keyboard: [[{ text: "📝 Fill Form", callback_data: "autofill_form" }]]
          }
      });`
    }
]);

// 4. handleFormFill.ts
replaceInFile('src/automation/handleFormFill.ts', [
    {
        target: `const screenshotBuffer = await page.screenshot({ timeout: 30000, type: 'jpeg', quality: 40 });
        await bot.sendPhoto(chatId, screenshotBuffer, { caption: "✅ Form submitted successfully. (Page 5)" });`,
        replacement: `await bot.sendMessage(chatId, "✅ Form submitted successfully. (Page 5)");`
    }
]);

// 5. handleAutoOfficeSelection.ts
replaceInFile('src/automation/handleAutoOfficeSelection.ts', [
    {
        target: `const finalScreenshot = await page.screenshot({ timeout: 30000, animations: 'disabled', type: 'jpeg', quality: 40 });
            await bot.sendPhoto(chatId, finalScreenshot, { 
                caption: "✅ Office selected successfully. Here is the new page!",
                reply_markup: {
                    inline_keyboard: [[{ text: "📝 Fill Phone & Email", callback_data: "fill_contact" }]]
                }
            });`,
        replacement: `await bot.sendMessage(chatId, "✅ Office selected successfully. Reached Contact Info Page!", { 
                reply_markup: {
                    inline_keyboard: [[{ text: "📝 Fill Phone & Email", callback_data: "fill_contact" }]]
                }
            });`
    },
    {
        target: `const fallbackScreenshot = await page.screenshot({ timeout: 30000, animations: 'disabled', type: 'jpeg', quality: 40 });
            await bot.sendPhoto(chatId, fallbackScreenshot, { caption: "🔙 Returned to Form Page via Fallback." });`,
        replacement: `await bot.sendMessage(chatId, "🔙 Returned to Form Page via Fallback.");`
    }
]);

console.log("Screenshots stripped successfully.");
