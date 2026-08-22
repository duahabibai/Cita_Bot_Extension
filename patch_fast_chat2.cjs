const fs = require('fs');
let code = fs.readFileSync('src/fastmode/fastChatMenu.ts', 'utf8');

const target = `        import('../../server.js').then(serverMod => {
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
        });`;

const replacement = `        import('../queue.js').then(queueMod => {
            const { browserQueue } = queueMod;
            browserQueue.enqueue(async () => {
                const fastExec = await import('./fastExecution.js');
                await fastExec.executeFastLaunch(chatId);
            }, (pos) => {
                bot.sendMessage(chatId, \`⏳ You are in queue (Position: \${pos}). Fast browser will launch soon...\`);
            });
        }).catch(e => {
            console.error(e);
            bot.sendMessage(chatId, "Failed to load queue. Falling back to direct launch.");
            import('./fastExecution.js').then(mod => mod.executeFastLaunch(chatId));
        });`;

code = code.replace(target, replacement);
fs.writeFileSync('src/fastmode/fastChatMenu.ts', code);
console.log("Patched fastChatMenu for queue import");
