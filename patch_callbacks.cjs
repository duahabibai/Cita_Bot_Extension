const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

// Insert imports at the top
const imports = `
import { handleProvinceSelection } from "./src/automation/handleProvinceSelection.ts";
import { handleOfficeSelection } from "./src/automation/handleOfficeSelection.ts";
import { handleTramiteSelection } from "./src/automation/handleTramiteSelection.ts";
import { initBotContext } from "./src/botContext.ts";
`;

serverCode = serverCode.replace('import StealthPlugin from "puppeteer-extra-plugin-stealth";', 'import StealthPlugin from "puppeteer-extra-plugin-stealth";' + imports);

// We need to call initBotContext right after bot is created (around line 125)
const botInitPattern = `const bot = new TelegramBot(token, { polling: true });`;
serverCode = serverCode.replace(botInitPattern, botInitPattern + `\ninitBotContext(bot, activeSessions, userStates, cleanupSession, persistSessionState, PROXY_CONFIG);\n`);

// Replace prov_ block
const provStart = serverCode.indexOf('if (data && data.startsWith("prov_")) {');
const officeStart = serverCode.indexOf('if (data && data.startsWith("office_")) {');
const tramiteStart = serverCode.indexOf('if (data && data.startsWith("tramite_")) {');
const genWeekStart = serverCode.indexOf('if (data === "gen_week" || data === "gen_month") {');

// Carefully replace blocks
serverCode = serverCode.slice(0, provStart) + 
`  if (data && data.startsWith("prov_")) {
    const index = parseInt(data.replace("prov_", ""));
    await handleProvinceSelection(chatId, query.id, index);
    return;
  }
  ` +
  serverCode.slice(officeStart, tramiteStart).replace(/if \(data && data\.startsWith\("office_"\)\) \{[\s\S]+?return;\s*\}/, `if (data && data.startsWith("office_")) {
    const index = parseInt(data.replace("office_", ""), 10);
    await handleOfficeSelection(chatId, query.id, index);
    return;
  }`) + 
  `  if (data && data.startsWith("tramite_")) {
    const index = parseInt(data.replace("tramite_", ""), 10);
    await handleTramiteSelection(chatId, query.id, index);
    return;
  }
  ` +
  serverCode.slice(genWeekStart);

fs.writeFileSync('server.ts', serverCode);
