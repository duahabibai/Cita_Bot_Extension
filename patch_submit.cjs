const fs = require('fs');
let code = fs.readFileSync('src/automation/handleSubmitForm.ts', 'utf8');

const updatedScreenshotCode = `
        const screenshotBuffer = await page.screenshot({
            timeout: 30000,
            animations: 'disabled',
            type: 'jpeg',
            quality: 70
        });
        
        // Add a button to request the next step after submit
        bot.sendPhoto(chatId, screenshotBuffer, { 
            caption: \`✅ Form submitted. Here is the next step (Usually requesting the appointment).\`,
            reply_markup: {
                inline_keyboard: [
                    [{ text: "📅 Solicitar Cita", callback_data: "solicitar_cita" }]
                ]
            }
        });
`;

code = code.replace(
  `        const screenshotBuffer = await page.screenshot({
            timeout: 30000,
            animations: 'disabled',
            type: 'jpeg',
            quality: 70
        });
        bot.sendPhoto(chatId, screenshotBuffer, { caption: \`✅ Form submitted. Here is the next step.\` });`,
  updatedScreenshotCode
);
fs.writeFileSync('src/automation/handleSubmitForm.ts', code);
