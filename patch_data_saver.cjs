const fs = require('fs');
let code = fs.readFileSync('src/handlers/launchBrowser.ts', 'utf8');

const target = 'const page = await context.newPage();';
const dataSaverCode = `const page = await context.newPage();

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

if (code.includes(target) && !code.includes('DATA SAVER MODE')) {
    code = code.replace(target, dataSaverCode);
    fs.writeFileSync('src/handlers/launchBrowser.ts', code);
    console.log("Data Saver injected.");
} else {
    console.log("Data Saver already present or target not found.");
}
