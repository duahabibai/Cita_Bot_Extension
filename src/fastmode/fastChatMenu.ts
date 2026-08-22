import TelegramBot from 'node-telegram-bot-api';
import { loadFastDb, saveFastDb, ProfileData } from './db.js';
import { fastBookingStates } from './chatState.js';
import crypto from 'crypto';

export function handleFastChatCallback(bot: TelegramBot, chatId: number, data: string, queryId: string, messageId?: number) {
    console.log("FASTCHAT CALLBACK RECEIVED:", { chatId, data, queryId, messageId });
    const db = loadFastDb();
    const state = fastBookingStates.get(chatId);
    
    // Helper to edit message if messageId exists, else send new
    const sendOrEdit = (text: string, markup?: any) => {
        if (messageId) {
            bot.editMessageText(text, { chat_id: chatId, message_id: messageId, reply_markup: markup }).catch(e => {
                bot.sendMessage(chatId, text, { reply_markup: markup });
            });
        } else {
            bot.sendMessage(chatId, text, { reply_markup: markup });
        }
    };

    // --- Draft Profile Handlers (Independent of state) ---
    if (data === 'fm_ignore') {
        bot.answerCallbackQuery(queryId);
        return true;
    }

    if (data.startsWith('fm_launch_prof_')) {
        const profId = data.replace('fm_launch_prof_', '');
        const profile = db.profiles?.find(p => p.id === profId);
        if (profile) {
            // Restore state
            fastBookingStates.set(chatId, {
                step: 'ready',
                province: profile.province,
                office: profile.office,
                tramite: profile.tramite,
                nie: profile.nie,
                name: profile.userName,
                phone: profile.phone,
                email: profile.email
            });
            // We can also assume dateRangeState is not strictly needed for launch as it defaults to first available
            // but normally it would be loaded. For now, fastExecution relies on dateRangeState.
            // Launch directly
            sendOrEdit(`🚀 Queuing Fast Auto-Pilot for Profile: ${profile.name}...`);
            bot.answerCallbackQuery(queryId);
            import('../queue.js').then(queueMod => {
                const { browserQueue } = queueMod;
                browserQueue.enqueue(async () => {
                    const fastExec = await import('./fastExecution.js');
                    await fastExec.executeFastLaunch(chatId);
                }, (pos) => {
                    bot.sendMessage(chatId, `⏳ Profile ${profile.name} in queue (Position: ${pos}). Launching soon...`);
                });
            }).catch(e => {
                import('./fastExecution.js').then(mod => mod.executeFastLaunch(chatId));
            });
        } else {
            bot.answerCallbackQuery(queryId, { text: "Profile not found!" });
        }
        return true;
    }

    if (data.startsWith('fm_del_prof_')) {
        const profId = data.replace('fm_del_prof_', '');
        db.profiles = db.profiles?.filter(p => p.id !== profId) || [];
        saveFastDb(db);
        bot.answerCallbackQuery(queryId, { text: "Profile Deleted!" });
        showDraftProfiles(bot, chatId, messageId);
        return true;
    }

    // --- State Dependent Handlers ---
    if (!state) return false;

    if (data === 'fm_save_draft') {
        state.step = 'awaiting_profile_name';
        sendOrEdit("💾 Please reply with a short Name/Title for this Draft Profile (e.g., Client Ali, Madrid TIE):");
        bot.answerCallbackQuery(queryId);
        return true;
    }

    if (data.startsWith('fm_prov_')) {
        const val = data.replace('fm_prov_', '');
        const prov = db.provinces.find(p => p.value === val);
        if (prov) {
            state.province = prov;
            
            // Show tramites and offices for this province
            const offices = db.offices[val] || [];
            const tramites = db.tramites[val] || [];
            
            if (offices.length > 0) {
                state.step = 'office';
                const kb = offices.map(o => ([{ text: o.text.substring(0,60), callback_data: `fm_off_${o.value}` }]));
                sendOrEdit(`🏢 Selected Province: ${prov.text}\n\nSelect Office:`, { inline_keyboard: kb });
            } else if (tramites.length > 0) {
                state.step = 'tramite';
                const kb = tramites.map(t => ([{ text: t.text.substring(0,60), callback_data: `fm_tra_${t.value}` }]));
                sendOrEdit(`📄 Selected Province: ${prov.text}\nNo offices found. Select Tramite:`, { inline_keyboard: kb });
            } else {
                state.step = 'nie';
                sendOrEdit(`⚠️ No offices or tramites saved in database for ${prov.text}. Proceeding anyway.\n\n📝 Please reply with NIE/DNI:`);
            }
        }
        bot.answerCallbackQuery(queryId);
        return true;
    }
    
    if (data.startsWith('fm_off_')) {
        const val = data.replace('fm_off_', '');
        const provVal = state.province!.value;
        const office = db.offices[provVal]?.find(o => o.value === val);
        if (office) {
            state.office = office;
            state.step = 'tramite';
            
            // Fix: ensure tramites is an array even if parsed weirdly
            let tramites = db.tramites[provVal] || [];
            
            // Fallback: If DB doesn't have tramites under provVal directly, try to search globally (some sites change keys)
            if (tramites.length === 0) {
                for (const key in db.tramites) {
                    if (key.includes(provVal.split('&')[0])) {
                        tramites = db.tramites[key];
                        break;
                    }
                }
            }
            
            if (!Array.isArray(tramites)) {
                tramites = Object.values(tramites);
            }
            
            console.log("Found tramites for province:", provVal, tramites.length);
            
            // If the tramites array has elements, build the keyboard
            const kb = tramites.map(t => ([{ text: t.text.substring(0,60), callback_data: `fm_tra_${t.value}` }]));
            
            if (kb.length > 0) {
                sendOrEdit(`🏢 Selected Office: ${office.text}\n\nSelect Tramite:`, { inline_keyboard: kb });
            } else {
                // Skip tramite if none saved
                state.step = 'nie';
                sendOrEdit("📝 No tramites saved in database for this province! Admin needs to scrape it. Please reply with NIE/DNI anyway to bypass:");
            }
        }
        bot.answerCallbackQuery(queryId);
        return true;
    }
    
    if (data.startsWith('fm_tra_')) {
        const val = data.replace('fm_tra_', '');
        const provVal = state.province!.value;
        const tramite = db.tramites[provVal]?.find(t => t.value === val);
        if (tramite) {
            state.tramite = tramite;
            state.step = 'nie';
            sendOrEdit(`✅ Tramite Selected: ${tramite.text}\n\n📝 Please reply with NIE/DNI:`);
        }
        bot.answerCallbackQuery(queryId);
        return true;
    }

    if (data === 'fm_launch_real') {
        sendOrEdit("🚀 Queuing Fast Auto-Pilot Mode...");
        bot.answerCallbackQuery(queryId);
        
        import('../queue.js').then(queueMod => {
            const { browserQueue } = queueMod;
            browserQueue.enqueue(async () => {
                const fastExec = await import('./fastExecution.js');
                await fastExec.executeFastLaunch(chatId);
            }, (pos) => {
                bot.sendMessage(chatId, `⏳ You are in queue (Position: ${pos}). Fast browser will launch soon...`);
            });
        }).catch(e => {
            console.error(e);
            bot.sendMessage(chatId, "Failed to load queue. Falling back to direct launch.");
            import('./fastExecution.js').then(mod => mod.executeFastLaunch(chatId));
        });
        
        return true;
    }

    return false;
}

export function showFastModeSummary(bot: TelegramBot, chatId: number) {
    const state = fastBookingStates.get(chatId);
    if (!state) return;

    let summary = `✅ **Data Collection Complete!**\n\n`;
    summary += `📍 Province: ${state.province?.text}\n`;
    if (state.office) summary += `🏢 Office: ${state.office?.text}\n`;
    if (state.tramite) summary += `📄 Tramite: ${state.tramite?.text}\n`;
    summary += `🆔 NIE: ${state.nie}\n`;
    summary += `👤 Name: ${state.name}\n`;
    summary += `📞 Phone: ${state.phone}\n`;
    summary += `📧 Email: ${state.email}\n\n`;
    summary += `Click below to launch the real browser in fast mode, or save as a draft!`;
    
    bot.sendMessage(chatId, summary, {
        reply_markup: {
            inline_keyboard: [
                [{ text: "🚀 Launch Real Browser", callback_data: "fm_launch_real" }],
                [{ text: "💾 Save as Draft Profile", callback_data: "fm_save_draft" }]
            ]
        }
    });
}

export function showDraftProfiles(bot: TelegramBot, chatId: number, editMessageId?: number) {
    const db = loadFastDb();
    const profiles = db.profiles || [];
    
    if (profiles.length === 0) {
        const text = "📂 *No Draft Profiles Found*\n\nYou haven't saved any profiles yet. Create one by completing the Fast Mode flow and clicking 'Save as Draft Profile'.";
        if (editMessageId) {
            bot.editMessageText(text, { chat_id: chatId, message_id: editMessageId, parse_mode: 'Markdown' }).catch(()=>{});
        } else {
            bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
        }
        return;
    }
    
    // Create a "Card" style UI for each profile
    // Row 1: Profile Name (Info button)
    // Row 2: [ ▶️ Launch ] [ 🗑️ Delete ]
    const inline_keyboard: any[] = [];
    profiles.forEach(p => {
        inline_keyboard.push([{ text: `👤 ${p.name.substring(0, 35)}`, callback_data: `fm_ignore` }]);
        inline_keyboard.push([
            { text: `▶️ Launch`, callback_data: `fm_launch_prof_${p.id}` },
            { text: `🗑️ Delete`, callback_data: `fm_del_prof_${p.id}` }
        ]);
    });
    
    const text = "📂 *Your Saved Draft Profiles:*\n\n👇 Manage and launch your profiles instantly:";
    
    if (editMessageId) {
        bot.editMessageText(text, { chat_id: chatId, message_id: editMessageId, parse_mode: 'Markdown', reply_markup: { inline_keyboard } }).catch(e => {
            bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard } });
        });
    } else {
        bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard } });
    }
}

export function handleFastChatText(bot: TelegramBot, chatId: number, text: string) {
    const state = fastBookingStates.get(chatId);
    if (!state) return false;

    if (state.step === 'awaiting_profile_name') {
        const db = loadFastDb();
        const profileId = crypto.randomUUID();
        const newProfile: ProfileData = {
            id: profileId,
            name: text.trim(),
            province: state.province,
            office: state.office,
            tramite: state.tramite,
            nie: state.nie,
            userName: state.name,
            phone: state.phone,
            email: state.email
        };
        db.profiles = db.profiles || [];
        db.profiles.push(newProfile);
        saveFastDb(db);
        
        state.step = 'ready'; // reset to ready
        
        bot.sendMessage(chatId, `✅ Draft Profile **"${newProfile.name}"** saved successfully!\nYou can launch it anytime from the Drafts menu.`);
        return true;
    }

    if (state.step === 'nie') {
        state.nie = text.trim();
        state.step = 'name';
        bot.sendMessage(chatId, "📝 Please reply with Full Name:");
        return true;
    }

    if (state.step === 'name') {
        state.name = text.trim();
        state.step = 'phone';
        bot.sendMessage(chatId, "📱 Please reply with Phone Number:");
        return true;
    }

    if (state.step === 'phone') {
        state.phone = text.trim();
        state.step = 'email';
        bot.sendMessage(chatId, "📧 Please reply with Email:");
        return true;
    }

    if (state.step === 'email') {
        state.email = text.trim();
        state.step = 'ready'; // we are ready, but we need date range first
        
        bot.sendMessage(chatId, "✅ Contact info saved. Now let's set the date range.");
        import('../automation/dateCalendarMenu.js').then(cal => {
            cal.sendDateSelectionMenu(bot, chatId);
        });
        
        return true;
    }

    return false;
}

export function startFastChat(bot: TelegramBot, chatId: number) {
    console.log("START FAST CHAT CALLED FOR:", chatId);
    // ALWAYS reset state when starting fresh
    fastBookingStates.delete(chatId);
    
    const db = loadFastDb();
    if (db.provinces.length === 0) {
        bot.sendMessage(chatId, "⚠️ Database is empty. Admin needs to scrape provinces first using '💾 Admin: Scrape Data'.");
        return;
    }
    
    fastBookingStates.set(chatId, { step: 'province' });
    
    const inlineKeyboard = [];
    let row: any[] = [];
    for (let i = 0; i < db.provinces.length; i++) {
        row.push({ text: db.provinces[i].text, callback_data: `fm_prov_${db.provinces[i].value}` });
        if (row.length === 3 || i === db.provinces.length - 1) {
            inlineKeyboard.push(row);
            row = [];
        }
    }
    
    bot.sendMessage(chatId, "⚡ FAST MODE: Select Province (From DB):", { reply_markup: { inline_keyboard: inlineKeyboard } });
}
