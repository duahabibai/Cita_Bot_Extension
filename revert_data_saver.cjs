const fs = require('fs');
let code = fs.readFileSync('src/handlers/launchBrowser.ts', 'utf8');

const dataSaverCode = `
    // --- DATA SAVER MODE ---
    // Blocks heavy files (images, fonts, CSS) to save proxy bandwidth
    await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (['image', 'font', 'stylesheet', 'media'].includes(type)) {
            route.abort();
        } else {
            route.continue();
        }
    });
    // -----------------------
`;

if (code.includes(dataSaverCode)) {
    code = code.replace(dataSaverCode, '');
    fs.writeFileSync('src/handlers/launchBrowser.ts', code);
    console.log("Data Saver removed successfully.");
} else {
    console.log("Data saver not found!");
}
