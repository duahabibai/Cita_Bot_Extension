const fs = require('fs');

function replaceWithRegex(file, pattern, replacement) {
    if(!fs.existsSync(file)) return;
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(pattern, replacement);
    fs.writeFileSync(file, code);
}

// launchBrowser.ts
replaceWithRegex('src/handlers/launchBrowser.ts', /await page\.goto\('https:\/\/sede\.administracionespublicas\.gob\.es\/pagina\/index\/directorio\/icpplus', \{ waitUntil: 'domcontentloaded', timeout: 60000 \}\);/g, `
    // Add extra time and a retry wrapper for unstable proxies
    try {
        await page.goto('https://sede.administracionespublicas.gob.es/pagina/index/directorio/icpplus', { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch(e) {
        if (e.message.includes('ERR_TUNNEL_CONNECTION_FAILED')) {
            await bot.sendMessage(chatId, "⚠️ Proxy error detected (ERR_TUNNEL_CONNECTION_FAILED). Trying to reconnect with a different node in 5 seconds...");
            await page.waitForTimeout(5000);
            await page.goto('https://sede.administracionespublicas.gob.es/pagina/index/directorio/icpplus', { waitUntil: 'domcontentloaded', timeout: 60000 });
        } else {
            throw e;
        }
    }
`);

console.log("Proxy timeout retry patched successfully.");
