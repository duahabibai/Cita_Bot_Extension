const fs = require('fs');
let code = fs.readFileSync('src/fastmode/fastExecution.ts', 'utf8');

// Fix step 5 selection to also include #btnEnviar so it works if the value isn't exactly "Solicitar Cita"
code = code.replace(
    /const btnSolicitar = await page\.\$\('input\[value="Solicitar Cita"\]'\);/g,
    `const btnSolicitar = await page.$('input[value*="Solicitar"], #btnEnviar');`
);

fs.writeFileSync('src/fastmode/fastExecution.ts', code);
