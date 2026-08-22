const fs = require('fs');

function fix(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');
    code = code.replace(/el\.click\(\); \/\/ Triggers inline onclick like document\.forms\[0\]\.submit\(\)/g, `el.click();
                   const evt = new MouseEvent('click', { view: window, bubbles: true, cancelable: true });
                   el.dispatchEvent(evt);`);
    fs.writeFileSync(filePath, code);
}
fix('src/automation/handleDynamicClick.ts');
console.log("Patched click fallback");
