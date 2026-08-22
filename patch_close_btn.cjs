const fs = require('fs');

// Patch launchBrowser.ts
let lb = fs.readFileSync('src/handlers/launchBrowser.ts', 'utf8');
const lbTarget = `       inlineKeyboard.push(row);
       }
       
       await bot.sendMessage(chatId, "📍 Please select a province:", { reply_markup: { inline_keyboard: inlineKeyboard } });`;
const lbReplacement = `       inlineKeyboard.push(row);
       }
       
       inlineKeyboard.push([{ text: "🛑 Close Browser (Save MBs)", callback_data: "close_browser" }]);
       
       await bot.sendMessage(chatId, "📍 Please select a province (or close browser to save MBs):", { reply_markup: { inline_keyboard: inlineKeyboard } });`;
fs.writeFileSync('src/handlers/launchBrowser.ts', lb.replace(lbTarget, lbReplacement));

// Patch handleProvinceSelection.ts
let hp = fs.readFileSync('src/automation/handleProvinceSelection.ts', 'utf8');

const hpTarget1 = `            inlineKeyboard.push([{ text: buttonText, callback_data: \`office_\${i}\` }]);
          }
          await bot.sendMessage(chatId, \`✅ Selected Province: \${selectedProv.text}\\n\\n🏢 Please select an Office:\`, { reply_markup: { inline_keyboard: inlineKeyboard } });`;
const hpReplacement1 = `            inlineKeyboard.push([{ text: buttonText, callback_data: \`office_\${i}\` }]);
          }
          inlineKeyboard.push([{ text: "🛑 Close Browser (Save MBs)", callback_data: "close_browser" }]);
          await bot.sendMessage(chatId, \`✅ Selected Province: \${selectedProv.text}\\n\\n🏢 Please select an Office:\`, { reply_markup: { inline_keyboard: inlineKeyboard } });`;

const hpTarget2 = `            inlineKeyboard.push([{ text: buttonText, callback_data: \`tramite_\${i}\` }]);
          }
          await bot.sendMessage(chatId, \`✅ Selected Province: \${selectedProv.text}\\n\\n📄 No specific office dropdown. Please select a Trámite:\`, { reply_markup: { inline_keyboard: inlineKeyboard } });`;
const hpReplacement2 = `            inlineKeyboard.push([{ text: buttonText, callback_data: \`tramite_\${i}\` }]);
          }
          inlineKeyboard.push([{ text: "🛑 Close Browser (Save MBs)", callback_data: "close_browser" }]);
          await bot.sendMessage(chatId, \`✅ Selected Province: \${selectedProv.text}\\n\\n📄 No specific office dropdown. Please select a Trámite:\`, { reply_markup: { inline_keyboard: inlineKeyboard } });`;

fs.writeFileSync('src/automation/handleProvinceSelection.ts', hp.replace(hpTarget1, hpReplacement1).replace(hpTarget2, hpReplacement2));

// Patch server.ts
let s = fs.readFileSync('server.ts', 'utf8');
const sTarget = `  // Fast chat intercept
  if (data) {
      try {
          const fastChat = await import('./src/fastmode/fastChatMenu.js');
          if (fastChat.handleFastChatCallback(bot, chatId, data, query.id)) return;
      } catch(e) {}
  }`;

const sReplacement = `  // Fast chat intercept
  if (data) {
      try {
          const fastChat = await import('./src/fastmode/fastChatMenu.js');
          if (fastChat.handleFastChatCallback(bot, chatId, data, query.id)) return;
      } catch(e) {}
  }
  
  if (data === "close_browser") {
      cleanupSession(chatId);
      bot.sendMessage(chatId, "🛑 Browser session closed successfully. MBs saved!");
      bot.answerCallbackQuery(query.id);
      return;
  }`;

fs.writeFileSync('server.ts', s.replace(sTarget, sReplacement));
console.log("Patched all files for close_browser button.");
