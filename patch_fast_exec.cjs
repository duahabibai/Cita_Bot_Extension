const fs = require('fs');
const file = 'src/fastmode/fastExecution.ts';
let code = fs.readFileSync(file, 'utf8');

// Fix province selection navigation race condition
code = code.replace(
    /await page\.click\('#btnAceptar'\);\s*\/\/\ 2\. Select Office \& Tramite\s*await bot\.sendMessage\(chatId, `🏢 Injecting Office \& Tramite for \${state\.province\.text}\.\.\.`\);\s*await page\.waitForLoadState\('domcontentloaded'\);/,
    `await Promise.all([\n      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),\n      page.click('#btnAceptar')\n    ]);\n\n    // 2. Select Office & Tramite\n    await bot.sendMessage(chatId, \`🏢 Injecting Office & Tramite for \${state.province.text}...\`);`
);

// Fix Entrar button navigation race condition
code = code.replace(
    /if \(btnEntrar\) \{\s*await humanDelay\(page\);\s*await btnEntrar\.click\(\);\s*\}/,
    `if (btnEntrar) {\n        await humanDelay(page);\n        await Promise.all([\n            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),\n            btnEntrar.click()\n        ]);\n    }`
);

// Fix Enviar (Submit Form) navigation race condition
code = code.replace(
    /if \(btnEnviar\) await btnEnviar\.click\(\);\s*else \{\s*\/\/ Fallback for some pages\s*const btnSiguiente = await page\.\$\('#btnSiguiente, input\[value="Siguiente"\], input\[name="btnSiguiente"\]'\);\s*if \(btnSiguiente\) await btnSiguiente\.click\(\);\s*\}/,
    `if (btnEnviar) {\n        await Promise.all([\n            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),\n            btnEnviar.click()\n        ]);\n    } else {\n        const btnSiguiente = await page.$('#btnSiguiente, input[value="Siguiente"], input[name="btnSiguiente"]');\n        if (btnSiguiente) {\n            await Promise.all([\n                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),\n                btnSiguiente.click()\n            ]);\n        }\n    }`
);

// Fix Solicitar Cita navigation race condition
code = code.replace(
    /if \(btnSolicitar\) \{\s*await humanDelay\(page\);\s*await btnSolicitar\.click\(\);\s*\}/,
    `if (btnSolicitar) {\n        await humanDelay(page);\n        await Promise.all([\n            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),\n            btnSolicitar.click()\n        ]);\n    }`
);

// Fix Contact Info Siguiente navigation race condition
code = code.replace(
    /if \(btnSiguiente\) await btnSiguiente\.click\(\);\s*\/\/ 7\. Arrival at Captcha \/ Date selection\s*await page\.waitForLoadState\('domcontentloaded'\);/,
    `if (btnSiguiente) {\n        await Promise.all([\n            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),\n            btnSiguiente.click()\n        ]);\n    }\n\n    // 7. Arrival at Captcha / Date selection`
);

// Fix the Tramite Dropdown selector to use actual locator logic instead of .innerHTML() matching
code = code.replace(
    /if \(html\.includes\(\`value="\${state\.tramite\.value}"\`\)\) \{\s*await sel\.selectOption\(state\.tramite\.value\);\s*break;\s*\}/,
    `if (html.includes(\`value="\${state.tramite.value}"\`) || html.includes(\`value='\${state.tramite.value}'\`)) {\n                       await sel.selectOption(state.tramite.value);\n                       break;\n                   }`
);

fs.writeFileSync(file, code);
console.log("Patched fastExecution.ts with robust navigation handling!");
