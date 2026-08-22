const fs = require('fs');
let lines = fs.readFileSync('server.ts', 'utf8').split('\n');

const imports = `
import { handleFormFill } from "./src/automation/handleFormFill.ts";
import { handleSubmitForm } from "./src/automation/handleSubmitForm.ts";
`;
lines.splice(17, 0, imports);

let newFile = lines.join('\n');
lines = newFile.split('\n');

const tramiteEnd = lines.findIndex(l => l.includes('if (data === "gen_week" || data === "gen_month") {'));

if (tramiteEnd > -1) {
    const replacement = `
  if (data === "autofill_form") {
    await handleFormFill(chatId, query.id);
    return;
  }
  
  if (data === "submit_form") {
    await handleSubmitForm(chatId, query.id);
    return;
  }
`;
    lines.splice(tramiteEnd, 0, replacement);
}

fs.writeFileSync('server.ts', lines.join('\n'));
