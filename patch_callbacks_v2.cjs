const fs = require('fs');

let lines = fs.readFileSync('server.ts', 'utf8').split('\n');

const imports = `
import { handleProvinceSelection } from "./src/automation/handleProvinceSelection.ts";
import { handleOfficeSelection } from "./src/automation/handleOfficeSelection.ts";
import { handleTramiteSelection } from "./src/automation/handleTramiteSelection.ts";
import { initBotContext } from "./src/botContext.ts";
`;

lines.splice(15, 0, imports);

// Now re-read the array string to find line indices, since we added lines
let newFile = lines.join('\n');
lines = newFile.split('\n');

const botInitIndex = lines.findIndex(l => l.includes("const bot = new TelegramBot(token, { polling: true });"));
lines.splice(botInitIndex + 1, 0, "initBotContext(bot, activeSessions, userStates, cleanupSession, persistSessionState, PROXY_CONFIG);");

newFile = lines.join('\n');
lines = newFile.split('\n');

const provIndex = lines.findIndex(l => l.includes('if (data && data.startsWith("prov_")) {'));
const genWeekIndex = lines.findIndex(l => l.includes('if (data === "gen_week" || data === "gen_month") {'));

if (provIndex > -1 && genWeekIndex > -1) {
    const replacement = `
  if (data && data.startsWith("prov_")) {
    const index = parseInt(data.replace("prov_", ""));
    await handleProvinceSelection(chatId, query.id, index);
    return;
  }
  
  if (data && data.startsWith("office_")) {
    const index = parseInt(data.replace("office_", ""), 10);
    await handleOfficeSelection(chatId, query.id, index);
    return;
  }
  
  if (data && data.startsWith("tramite_")) {
    const index = parseInt(data.replace("tramite_", ""), 10);
    await handleTramiteSelection(chatId, query.id, index);
    return;
  }
`;
    lines.splice(provIndex, genWeekIndex - provIndex, replacement);
}

fs.writeFileSync('server.ts', lines.join('\n'));
