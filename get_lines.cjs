const fs = require('fs');

function show(file) {
    if(!fs.existsSync(file)) return;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    console.log(`\n--- ${file} ---`);
    lines.forEach((l, i) => {
        if(l.includes('screenshotBuffer =') || l.includes('sendPhoto') || l.includes('nextScreenshot =') || l.includes('finalScreenshot =')) {
            console.log(`${i+1}: ${l}`);
        }
    });
}

show('src/handlers/launchBrowser.ts');
show('src/automation/handleProvinceSelection.ts');
show('src/automation/handleTramiteSelection.ts');
show('src/automation/handleFormFill.ts');
show('src/automation/handleAutoOfficeSelection.ts');
show('src/automation/handleContactInfo.ts');

