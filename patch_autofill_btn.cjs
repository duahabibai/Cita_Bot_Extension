const fs = require('fs');
let code = fs.readFileSync('src/automation/handleTramiteSelection.ts', 'utf8');

code = code.replace(
  '[{ text: "📝 Autofill Form (NIE/Name)", callback_data: "autofill_form" }]',
  '[{ text: "📝 Continue to Autofill", callback_data: "autofill_form" }]'
);

fs.writeFileSync('src/automation/handleTramiteSelection.ts', code);
