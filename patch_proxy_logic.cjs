const fs = require('fs');

let code = fs.readFileSync('src/handlers/launchBrowser.ts', 'utf8');

const oldCheck = `    const pageText = await page.evaluate(() => document.body.innerText || '');
    if (pageText.includes('vuelva a intentarlo más tarde') || pageText.includes('ERROR [503]')) {`;

const newCheck = `    const pageText = await page.evaluate(() => document.body.innerText || '');
    if (pageText.includes('vuelva a intentarlo más tarde') || pageText.includes('ERROR [503]') || pageText.includes('Forbidden')) {`;

code = code.replace(oldCheck, newCheck);

const oldCheck2 = `if (postSubmitText.includes('Forbidden') || postSubmitText.includes('vuelva a intentarlo') || postSubmitText.includes('ERROR [503]')) {
            if (usingOldSession) {`;

const newCheck2 = `if (postSubmitText.includes('Forbidden') || postSubmitText.includes('vuelva a intentarlo') || postSubmitText.includes('ERROR [503]')) {
            if (true) { // Always force a new session on 403`;

code = code.replace(oldCheck2, newCheck2);
fs.writeFileSync('src/handlers/launchBrowser.ts', code);
console.log("Patched proxy fallback");
