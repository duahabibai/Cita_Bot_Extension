const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const antiSleepCode = `// --- ANTI-SLEEP / ANTI-CRASH LOGIC ---
process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception:', err);
    // Keep process alive
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
    // Keep process alive
});

// Periodic ping to keep the event loop and hosting environment awake
setInterval(() => {
    console.log('[Heartbeat] Keeping bot awake...', new Date().toISOString());
}, 5 * 60 * 1000);
// ------------------------------------

`;

// insert antiSleepCode near the top, after imports
const importEndIndex = code.lastIndexOf('import ');
let insertIndex = code.indexOf('\n', importEndIndex) + 1;
if (insertIndex === 0) insertIndex = 0;

code = code.slice(0, insertIndex) + '\n' + antiSleepCode + code.slice(insertIndex);

fs.writeFileSync('server.ts', code);
console.log("server.ts patched with anti-sleep logic.");
