const fs = require('fs');
let code = fs.readFileSync('src/automation/handleFormFill.ts', 'utf8');
code = code.replace(/await bot\.sendMessage\(chatId, "📸 Next page loaded! Taking screenshot\.\.\."\);/g, '');
fs.writeFileSync('src/automation/handleFormFill.ts', code);
