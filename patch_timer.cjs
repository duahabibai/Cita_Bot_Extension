const fs = require('fs');
let code = fs.readFileSync('src/fastmode/fastExecution.ts', 'utf8');

const target = `    // Set step so the legacy manual captcha solver works
    const session = activeSessions.get(chatId);
    if (session) session.step = 'captcha_page_loaded';`;

const replacement = `    // Provide the screenshot exactly as handleContactInfo does
    await bot.sendPhoto(chatId, buffer, { caption: "✅ Next page reached! Here is the screen:" });

    const session = activeSessions.get(chatId);
    if (session) {
        session.timeoutId = setTimeout(async () => {
            await bot.sendMessage(chatId, "⏳ Session expired due to 10 minutes of inactivity.");
            const { cleanupSession } = await import('../botContext.js');
            cleanupSession(chatId);
        }, 10 * 60 * 1000);
    }`;

code = code.replace(`await bot.sendPhoto(chatId, buffer, { caption: "✅ Arrived at Final Step! Solve the Captcha or select your time." });`, "");
code = code.replace(target, replacement);

fs.writeFileSync('src/fastmode/fastExecution.ts', code);
console.log("Patched fastExecution timer");
