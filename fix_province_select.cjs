const fs = require('fs');
let code = fs.readFileSync('src/automation/handleProvinceSelection.ts', 'utf8');

const target = 'await bot.sendMessage(chatId, `✅ Selected Province: ${selectedProv.text}\\n⚠️ No offices or trámites found on this page. The layout might be different.`);';
const replacement = `await bot.sendPhoto(chatId, screenshotBuffer, { caption: \`✅ Selected Province: \${selectedProv.text}\\n⚠️ No offices or trámites found on this page. The layout might be different.\` });`;

code = code.replace(target, replacement);
fs.writeFileSync('src/automation/handleProvinceSelection.ts', code);
