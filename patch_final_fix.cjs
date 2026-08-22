const fs = require('fs');

function fixFiles(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');

    // 1. Fix the ID for Cl@ve button (add #btnAccesoClave)
    code = code.replace(/'#btnEnviarClave'/g, "'#btnAccesoClave', '#btnEnviarClave'");

    // 2. Fix the escaped string literal variables
    code = code.replace(/\\\$\\{selectedBtn\.text\\}/g, '${selectedBtn.text}');

    // 3. Improve the click fallback to ensure it triggers inline onclick events (like document.forms[0].submit())
    if (filePath.includes('handleDynamicClick')) {
        const oldFallback = `const evt = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
                   el.dispatchEvent(evt);`;
        const newFallback = `el.click(); // Triggers inline onclick like document.forms[0].submit()`;
        code = code.replace(oldFallback, newFallback);
    }

    fs.writeFileSync(filePath, code);
}

fixFiles('src/automation/handleTramiteSelection.ts');
fixFiles('src/automation/handleDynamicClick.ts');
console.log("Patched buttons and strings!");
