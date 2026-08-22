const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `  if (data && data.startsWith("prov_")) {`;

const newCode = `  if (data && data.startsWith("dyn_")) {
    const index = parseInt(data.replace("dyn_", ""), 10);
    const { handleDynamicClick } = await import('./src/automation/handleDynamicClick.js');
    await handleDynamicClick(chatId, query.id, index);
    return;
  }

  if (data && data.startsWith("prov_")) {`;

const finalCode = code.replace(targetStr, newCode);
fs.writeFileSync('server.ts', finalCode);
console.log("Patched server.ts");
