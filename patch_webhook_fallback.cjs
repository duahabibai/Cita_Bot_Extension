const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldWebhookSetup = `      try {
          await bot.setWebHook(webhookUrl);
          console.log("✅ Webhook successfully set to:", webhookUrl);
      } catch (e) {
          console.error("❌ Failed to set webhook:", e);
      }`;

const newWebhookSetup = `      try {
          let success = false;
          for (let i = 0; i < 3; i++) {
              try {
                  await bot.setWebHook(webhookUrl);
                  console.log("✅ Webhook successfully set to:", webhookUrl);
                  success = true;
                  break;
              } catch (e) {
                  console.log(\`Webhook attempt \${i+1} failed...\`);
                  await new Promise(r => setTimeout(r, 2000));
              }
          }
          if (!success) {
              console.error("❌ Failed to set webhook after 3 attempts. Falling back to POLLING.");
              bot.startPolling();
          }
      } catch (e) {
          console.error("❌ Error in webhook setup:", e);
          bot.startPolling();
      }`;

code = code.replace(oldWebhookSetup, newWebhookSetup);
fs.writeFileSync('server.ts', code);
console.log("Patched webhook fallback");
