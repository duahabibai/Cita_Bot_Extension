const fs = require('fs');

function updateScraper(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');
    
    // Add more broad selectors for Clave
    const oldClaveSelector = `{ id: 'btnClave', label: 'Acceder con Cl@ve', selectors: ['#btnEnviarClave', 'input[value*="Cl@ve"]', 'input[value*="Clave"]', 'img[alt*="Cl@ve"]'] }`;
    const newClaveSelector = `{ id: 'btnClave', label: 'Acceder con Cl@ve', selectors: ['#btnEnviarClave', 'input[value*="Cl@ve"]', 'input[value*="Clave"]', 'input[name*="clave"]', 'img[alt*="Cl@ve"]', 'a[href*="clave"]', 'button[title*="Cl@ve"]', 'button[id*="clave"]', '.botonClave', '#clave'] }`;
    
    code = code.replace(oldClaveSelector, newClaveSelector);
    fs.writeFileSync(filePath, code);
}

updateScraper('src/automation/handleTramiteSelection.ts');
updateScraper('src/automation/handleDynamicClick.ts');
console.log("Patched Cl@ve selectors");
