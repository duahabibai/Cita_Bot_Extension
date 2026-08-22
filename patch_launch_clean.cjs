const fs = require('fs');

let code = fs.readFileSync('src/handlers/launchBrowser.ts', 'utf8');

const sessionLoadCode = `    if (fs.existsSync(sessionFilePath)) {
      contextOptions.storageState = sessionFilePath;
    }`;

code = code.replace(sessionLoadCode, `    // 🚨 IMPORTANT FIX: Never load old cookies when starting a fresh browser!
    // Old cookies cause the 503 error because Extranjeria's firewall flags them.
    if (fs.existsSync(sessionFilePath)) {
        fs.unlinkSync(sessionFilePath);
    }`);

fs.writeFileSync('src/handlers/launchBrowser.ts', code);
