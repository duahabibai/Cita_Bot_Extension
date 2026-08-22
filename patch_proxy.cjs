const fs = require('fs');

let code = fs.readFileSync('src/utils/browser.ts', 'utf8');

// Change proxy configuration to rely on better rotating proxies, or remove hardcoded proxy limits if any.
// Looking at what causes 403 Forbidden on the *very first* hit.

// Let's check how proxy is launched
console.log(code.match(/--proxy-server=[^'"]+/g));

