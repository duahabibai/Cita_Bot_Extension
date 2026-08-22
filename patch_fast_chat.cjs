const fs = require('fs');
let code = fs.readFileSync('src/fastmode/fastChatMenu.ts', 'utf8');

const target = `    if (data === 'fm_launch_real') {
        bot.sendMessage(chatId, "🚀 Starting Live Execution with saved data! Please wait...");
        // This will be wired up to fast execution script
        bot.answerCallbackQuery(queryId);
        return true;
    }`;

const replacement = `    if (data === 'fm_launch_real') {
        bot.sendMessage(chatId, "🚀 Queuing Fast Auto-Pilot Mode...");
        bot.answerCallbackQuery(queryId);
        
        import('../../server.js').then(serverMod => {
            const { browserQueue } = serverMod;
            if (browserQueue) {
                browserQueue.enqueue(async () => {
                    const fastExec = await import('./fastExecution.js');
                    await fastExec.executeFastLaunch(chatId);
                }, (pos) => {
                    bot.sendMessage(chatId, \`⏳ You are in queue (Position: \${pos}). Fast browser will launch soon...\`);
                });
            } else {
                bot.sendMessage(chatId, "Queue not exported. Falling back to direct launch.");
                import('./fastExecution.js').then(mod => mod.executeFastLaunch(chatId));
            }
        }).catch(e => {
            // fallback
            import('./fastExecution.js').then(mod => mod.executeFastLaunch(chatId));
        });
        
        return true;
    }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/fastmode/fastChatMenu.ts', code);
console.log("Patched fastChatMenu");
