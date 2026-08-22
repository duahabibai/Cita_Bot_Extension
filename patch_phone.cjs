const fs = require('fs');
let code = fs.readFileSync('src/fastmode/fastExecution.ts', 'utf8');

const oldWait = `await page.waitForSelector('#txtTelefonoMac, #txtTelefono, input[type="tel"], input[name="txtTelefonoMac"], input[name="txtTelefonoCitante"]', { timeout: 30000 }).catch(() => {});`;
const newWait = `await page.waitForSelector('#txtTelefonoMac, #txtTelefono, input[type="tel"], input[name="txtTelefonoMac"], input[name="txtTelefonoCitante"], input[name="txtTelefonoCitado"]', { timeout: 15000 }).catch(() => {});`;

code = code.replace(oldWait, newWait);

const oldPhoneEval = `        setVal('input[name="txtTelefonoCitante"]', data.phone);`;
const newPhoneEval = `        setVal('input[name="txtTelefonoCitante"]', data.phone);
        setVal('input[name="txtTelefonoCitado"]', data.phone);`;

code = code.replace(oldPhoneEval, newPhoneEval);

// Lower the 30s timeout on steps where it's redundant to speed up the fast mode
code = code.replace(
    /await page\.waitForSelector\('#txtIdCitante, #txtIdCitado', \{ timeout: 30000 \}\)\.catch\(\(\) => \{\}\);/g,
    `await page.waitForSelector('#txtIdCitante, #txtIdCitado', { timeout: 15000 }).catch(() => {});`
);

code = code.replace(
    /await page\.waitForSelector\('#txtIdCitante, #txtIdCitado, #btnEntrar', \{ timeout: 30000 \}\)\.catch\(\(\) => \{\}\);/g,
    `await page.waitForSelector('#txtIdCitante, #txtIdCitado, #btnEntrar', { timeout: 15000 }).catch(() => {});`
);

fs.writeFileSync('src/fastmode/fastExecution.ts', code);
console.log("Patched phone and timeouts");
