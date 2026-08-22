const fs = require('fs');
let code = fs.readFileSync('src/fastmode/fastExecution.ts', 'utf8');

// Replace waitForSelector
code = code.replace(
    /await page\.waitForSelector\('#txtIdCitante, #btnEntrar', \{ timeout: 30000 \}\)\.catch\(\(\) => \{\}\);/g,
    `await page.waitForSelector('#txtIdCitante, #txtIdCitado, #btnEntrar', { timeout: 30000 }).catch(() => {});`
);

code = code.replace(
    /await page\.waitForSelector\('#txtIdCitante', \{ timeout: 30000 \}\)\.catch\(\(\) => \{\}\);/g,
    `await page.waitForSelector('#txtIdCitante, #txtIdCitado', { timeout: 30000 }).catch(() => {});`
);

// Add more selectors in evaluate
const oldEval = `        setVal('#txtIdCitante', data.nie);
        setVal('#txtDesCitante', data.name);`;

const newEval = `        setVal('#txtIdCitante', data.nie);
        setVal('#txtIdCitado', data.nie);
        setVal('#txtDesCitante', data.name);
        setVal('#txtDesCitado', data.name);
        setVal('input[name="txtDesCitante"]', data.name);
        setVal('input[name="txtDesCitado"]', data.name);`;

code = code.replace(oldEval, newEval);

fs.writeFileSync('src/fastmode/fastExecution.ts', code);
console.log("Patched NIE and Name selectors");
