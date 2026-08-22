const fs = require('fs');

let code = fs.readFileSync('src/automation/handleFormFill.ts', 'utf8');
code = code.replace(
    'await bot.answerCallbackQuery(queryId);',
    'if (queryId) await bot.answerCallbackQuery(queryId).catch(() => {});'
);
fs.writeFileSync('src/automation/handleFormFill.ts', code);
console.log("Fixed handleFormFill.ts");
