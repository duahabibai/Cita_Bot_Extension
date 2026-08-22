const fs = require('fs');
const glob = require('glob');

// Compress all screenshot qualities to 40
glob('src/**/*.ts', (err, files) => {
    files.forEach(file => {
        let code = fs.readFileSync(file, 'utf8');
        let modified = false;
        
        // Quality 70 -> 40
        if (code.includes('quality: 70')) { code = code.replace(/quality:\s*70/g, 'quality: 40'); modified = true; }
        // Quality 60 -> 40
        if (code.includes('quality: 60')) { code = code.replace(/quality:\s*60/g, 'quality: 40'); modified = true; }
        // Quality 50 -> 40
        if (code.includes('quality: 50')) { code = code.replace(/quality:\s*50/g, 'quality: 40'); modified = true; }

        if (modified) {
            fs.writeFileSync(file, code);
            console.log("Compressed screenshots in:", file);
        }
    });
});
