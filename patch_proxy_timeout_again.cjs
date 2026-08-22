const fs = require('fs');
let code = fs.readFileSync('src/handlers/launchBrowser.ts', 'utf8');

// The proxy connection error timeout is too fast for some residential proxies. Let's make the timeout much larger.
code = code.replace(/timeout: 60000/g, 'timeout: 120000');
fs.writeFileSync('src/handlers/launchBrowser.ts', code);
console.log("Increased proxy timeout");
