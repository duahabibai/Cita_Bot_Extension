const fs = require('fs');
let code = fs.readFileSync('src/fastmode/fastExecution.ts', 'utf8');

// We will use a reliable navigation clicker function and replace the brittle logic.

code = code.replace(
    /const btnAceptar2 = await page\.\$\('#btnAceptar'\);\s*if \(btnAceptar2\) \{\s*await Promise\.all\(\[\s*page\.waitForNavigation\(\{ waitUntil: 'domcontentloaded', timeout: 30000 \}\)\.catch\(\(\) => \{\}\),\s*btnAceptar2\.click\(\)\s*\]\);\s*\}/g,
    `const btnAceptar2 = await page.$('#btnAceptar');
    if (btnAceptar2) {
        await btnAceptar2.click();
        await page.waitForSelector('#btnEntrar, #txtIdCitante', { timeout: 30000 }).catch(() => {});
    }`
);

// Step 3
code = code.replace(
    /const btnEntrar = await page\.\$\('#btnEntrar'\);\s*if \(btnEntrar\) \{\s*await humanDelay\(page\);\s*await Promise\.all\(\[\s*page\.waitForNavigation\(\{ waitUntil: 'domcontentloaded', timeout: 30000 \}\)\.catch\(\(\) => \{\}\),\s*btnEntrar\.click\(\)\s*\]\);\s*\}/g,
    `const btnEntrar = await page.$('#btnEntrar');
    if (btnEntrar) {
        await humanDelay(page);
        await btnEntrar.click();
    }`
);

// Step 4 Wait
code = code.replace(
    /await page\.waitForSelector\('#txtIdCitante', \{ timeout: 15000 \}\)\.catch\(\(\) => \{\}\);/g,
    `await page.waitForSelector('#txtIdCitante', { timeout: 30000 }).catch(() => {});`
);

// Step 4 Click
code = code.replace(
    /const btnEnviar = await page\.\$\('#btnEnviar'\);\s*if \(btnEnviar\) \{\s*await Promise\.all\(\[\s*page\.waitForNavigation\(\{ waitUntil: 'domcontentloaded', timeout: 30000 \}\)\.catch\(\(\) => \{\}\),\s*btnEnviar\.click\(\)\s*\]\);\s*\} else \{\s*const btnSiguiente = await page\.\$\('#btnSiguiente, input\[value="Siguiente"\], input\[name="btnSiguiente"\]'\);\s*if \(btnSiguiente\) \{\s*await Promise\.all\(\[\s*page\.waitForNavigation\(\{ waitUntil: 'domcontentloaded', timeout: 30000 \}\)\.catch\(\(\) => \{\}\),\s*btnSiguiente\.click\(\)\s*\]\);\s*\}\s*\}/g,
    `const btnEnviar = await page.$('#btnEnviar');
    if (btnEnviar) {
        await btnEnviar.click();
    } else {
        const btnSiguiente = await page.$('#btnSiguiente, input[value="Siguiente"], input[name="btnSiguiente"]');
        if (btnSiguiente) {
            await btnSiguiente.click();
        }
    }
    // After clicking Aceptar on NIE page, we should wait for the next page elements (either Solicitar Cita button, or Phone input)
    await page.waitForSelector('input[value="Solicitar Cita"], input[name="txtTelefonoCitante"]', { timeout: 30000 }).catch(() => {});
    `
);

// Step 5 Click
code = code.replace(
    /await bot\.sendMessage\(chatId, "⏩ Clicking 'Solicitar Cita'\.\.\."\);\s*await page\.waitForTimeout\(1000\); \/\/ safety wait\s*await page\.waitForSelector\('#btnEnviar', \{ timeout: 15000 \}\)\.catch\(\(\) => \{\}\);\s*const btnSolicitar = await page\.\$\('#btnEnviar'\);\s*if \(btnSolicitar\) \{\s*await humanDelay\(page\);\s*await Promise\.all\(\[\s*page\.waitForNavigation\(\{ waitUntil: 'domcontentloaded', timeout: 30000 \}\)\.catch\(\(\) => \{\}\),\s*btnSolicitar\.click\(\)\s*\]\);\s*\}/g,
    `await bot.sendMessage(chatId, "⏩ Clicking 'Solicitar Cita'...");
    const btnSolicitar = await page.$('input[value="Solicitar Cita"]');
    if (btnSolicitar) {
        await humanDelay(page);
        await btnSolicitar.click();
    }
    // Now wait for Phone input page
    await page.waitForSelector('input[name="txtTelefonoCitante"]', { timeout: 30000 }).catch(() => {});
    `
);


// Let's also wrap the inputNie filling with a check and wait, in case the element is disabled temporarily.
code = code.replace(
    /const inputNie = await page\.\$\('input#txtIdCitante'\);\s*if \(inputNie\) await inputNie\.fill\(state\.nie\);\s*const inputName = await page\.\$\('input#txtDesCitante'\);\s*if \(inputName\) await inputName\.fill\(state\.name\);/g,
    `const inputNie = await page.$('input#txtIdCitante');
    if (inputNie) {
        await inputNie.waitForElementState('stable', { timeout: 5000 }).catch(()=>{});
        await inputNie.fill(state.nie);
    }
    const inputName = await page.$('input#txtDesCitante');
    if (inputName) {
        await inputName.waitForElementState('stable', { timeout: 5000 }).catch(()=>{});
        await inputName.fill(state.name);
    }`
);

fs.writeFileSync('src/fastmode/fastExecution.ts', code);
console.log("Patched correctly.");
