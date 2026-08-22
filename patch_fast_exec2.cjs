const fs = require('fs');
const file = 'src/fastmode/fastExecution.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    /await page\.selectOption\('select#sede', state\.office\.value\);/g,
    `await page.selectOption('select#sede', state.office.value);\n               await page.waitForTimeout(2000); // Allow ajax reload of tramites`
);

fs.writeFileSync(file, code);
