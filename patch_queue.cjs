const fs = require('fs');
let code = fs.readFileSync('src/queue.ts', 'utf8');

const target = `        try {
          await task();
          resolve();
        } catch (error) {
          reject(error);
        }`;

const replacement = `        try {
          // Wrap task in a Promise.race to prevent indefinite hangs
          const timeoutPromise = new Promise((_, rejectTimeout) => {
            setTimeout(() => rejectTimeout(new Error("Queue task timed out after 3 minutes")), 180000);
          });
          await Promise.race([task(), timeoutPromise]);
          resolve();
        } catch (error) {
          console.error("Queue Task Error/Timeout:", error);
          reject(error);
        }`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src/queue.ts', code);
    console.log("Queue patched successfully.");
} else {
    console.error("Target not found in queue!");
}
