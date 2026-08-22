const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = 'import { handleContactInfo } from "./src/automation/handleContactInfo.ts";\n' + code;
fs.writeFileSync('server.ts', code);
console.log("Fixed missing import.");
