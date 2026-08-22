const fs = require('fs');
let code = fs.readFileSync('src/fastmode/fastExecution.ts', 'utf8');

const step2Regex = /const btnAceptar2 = await page\.\$\('#btnAceptar'\);\s*if \(btnAceptar2\) \{\s*await btnAceptar2\.click\(\);\s*await page\.waitForSelector\('#btnEntrar, #txtIdCitante', \{ timeout: 30000 \}\)\.catch\(\(\) => \{\}\);\s*\}/g;

const robustStep2 = `const preUrlAceptar = page.url();
    await page.evaluate(() => {
        const btn = document.querySelector('#btnAceptar') as HTMLElement;
        if (btn) btn.click();
    });
    await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }).catch(() => {});
    if (page.url() === preUrlAceptar) {
        await page.click('#btnAceptar').catch(() => {});
        await page.waitForSelector('#btnEntrar, #txtIdCitante', { timeout: 30000 }).catch(() => {});
    }`;

code = code.replace(step2Regex, robustStep2);
fs.writeFileSync('src/fastmode/fastExecution.ts', code);
console.log("Patched step 2 click");
