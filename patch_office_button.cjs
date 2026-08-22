const fs = require('fs');
let code = fs.readFileSync('src/automation/handleAutoOfficeSelection.ts', 'utf8');

// Replace the final screenshot logic to include the button
const target = `await bot.sendPhoto(chatId, finalScreenshot, { caption: "✅ Office selected successfully. Here is the new page!" });`;
const replacement = `await bot.sendPhoto(chatId, finalScreenshot, { 
                caption: "✅ Office selected successfully. Here is the new page!",
                reply_markup: {
                    inline_keyboard: [[{ text: "📝 Fill Phone & Email", callback_data: "fill_contact" }]]
                }
            });`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src/automation/handleAutoOfficeSelection.ts', code);
    console.log("Patched successfully.");
} else {
    console.error("Target not found!");
}
