const fs = require('fs');
let code = fs.readFileSync('src/fastmode/fastExecution.ts', 'utf8');

// Fix 1: Step 2 Aceptar without waitForNavigation
code = code.replace(
    /const btnAceptar2 = await page\.\$\('#btnAceptar'\);\s*if \(btnAceptar2\) await btnAceptar2\.click\(\);/g,
    `const btnAceptar2 = await page.$('#btnAceptar');
    if (btnAceptar2) {
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
            btnAceptar2.click()
        ]);
    }`
);

// Fix 2: Step 4 Wait for selector
code = code.replace(
    /await bot\.sendMessage\(chatId, "📝 Filling NIE & Name\.\.\."\);\s*await page\.waitForLoadState\('domcontentloaded'\);/g,
    `await bot.sendMessage(chatId, "📝 Filling NIE & Name...");
    await page.waitForSelector('#txtIdCitante', { timeout: 15000 }).catch(() => {});`
);

// Fix 3: Step 5 Wait for selector
code = code.replace(
    /await bot\.sendMessage\(chatId, "⏩ Clicking 'Solicitar Cita'\.\.\."\);\s*await page\.waitForLoadState\('domcontentloaded'\);/g,
    `await bot.sendMessage(chatId, "⏩ Clicking 'Solicitar Cita'...");
    await page.waitForTimeout(1000); // safety wait
    await page.waitForSelector('#btnEnviar', { timeout: 15000 }).catch(() => {});`
);

// Fix 4: Step 6 Wait for selector
code = code.replace(
    /await bot\.sendMessage\(chatId, "📞 Filling Phone & Email\.\.\."\);\s*await page\.waitForLoadState\('domcontentloaded'\);/g,
    `await bot.sendMessage(chatId, "📞 Filling Phone & Email...");
    await page.waitForSelector('input[name="txtTelefonoCitante"]', { timeout: 15000 }).catch(() => {});`
);

fs.writeFileSync('src/fastmode/fastExecution.ts', code);
console.log("Patched fastExecution.ts wait logic");
