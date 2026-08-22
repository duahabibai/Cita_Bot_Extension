const fs = require('fs');

function fix(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');
    
    // The previous sed command completely removed `const foundBtns = [];` from inside the `page.evaluate()` block, 
    // causing a ReferenceError in the browser context. We need to put it back exactly inside the evaluate function.
    
    // We will find `// 1. Check known selectors first` and prepend `const foundBtns = [];\n          ` to it.
    
    code = code.replace(/\/\/ 1\. Check known selectors first/g, 'const foundBtns = [];\n          // 1. Check known selectors first');
    fs.writeFileSync(filePath, code);
}

fix('src/automation/handleTramiteSelection.ts');
fix('src/automation/handleDynamicClick.ts');
console.log("Fixed foundBtns ReferenceError");
