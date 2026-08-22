const fs = require('fs');
let code = fs.readFileSync('src/automation/handleContactInfo.ts', 'utf8');
code = code.replace(
    "setVal('#txtTelefonoMac', data.phone);",
    "setVal('#txtTelefonoMac', data.phone);\n            setVal('#txtTelefono', data.phone);\n            setVal('input[type=\"tel\"]', data.phone);"
);
code = code.replace(
    "setVal('#txtCorreoElectronico', data.email);",
    "setVal('#txtCorreoElectronico', data.email);\n            setVal('#email', data.email);\n            setVal('input[type=\"email\"]:not([id*=\"Repite\"])', data.email);"
);
fs.writeFileSync('src/automation/handleContactInfo.ts', code);
console.log("Patched contact info selectors.");
