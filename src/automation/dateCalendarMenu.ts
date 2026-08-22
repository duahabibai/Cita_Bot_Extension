import * as TelegramBotModule from "node-telegram-bot-api";

// Define the state for date selection
export const dateRangeState = new Map<number, { 
    step: 'idle' | 'awaiting_start' | 'awaiting_end' | 'completed',
    startDate?: Date, 
    endDate?: Date,
    monthOffset: number 
}>();

// Helper to generate the calendar keyboard
export function generateCalendarKeyboard(monthOffset: number = 0, isSelectingEnd: boolean = false) {
    const today = new Date();
    const targetMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthName = monthNames[targetMonth.getMonth()];
    const year = targetMonth.getFullYear();

    const keyboard: TelegramBotModule.InlineKeyboardButton[][] = [];

    // Header (Month & Year) and Navigation
    keyboard.push([
        { text: "◀️", callback_data: `cal_prev_${monthOffset}` },
        { text: `🗓 ${monthName} ${year}`, callback_data: "cal_ignore" },
        { text: "▶️", callback_data: `cal_next_${monthOffset}` }
    ]);

    // Days of week
    keyboard.push([
        { text: "Mo", callback_data: "cal_ignore" },
        { text: "Tu", callback_data: "cal_ignore" },
        { text: "We", callback_data: "cal_ignore" },
        { text: "Th", callback_data: "cal_ignore" },
        { text: "Fr", callback_data: "cal_ignore" },
        { text: "Sa", callback_data: "cal_ignore" },
        { text: "Su", callback_data: "cal_ignore" }
    ]);

    // Days calculation
    const daysInMonth = new Date(year, targetMonth.getMonth() + 1, 0).getDate();
    let firstDayOfWeek = targetMonth.getDay(); // 0 is Sunday
    firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Convert to Monday=0

    let currentWeek: TelegramBotModule.InlineKeyboardButton[] = [];
    
    // Empty slots before first day
    for (let i = 0; i < firstDayOfWeek; i++) {
        currentWeek.push({ text: "·", callback_data: "cal_ignore" });
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(targetMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        currentWeek.push({ text: `${day}`, callback_data: `cal_day_${dateStr}` });

        if (currentWeek.length === 7) {
            keyboard.push(currentWeek);
            currentWeek = [];
        }
    }

    // Fill remaining days of the last week
    if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
            currentWeek.push({ text: "·", callback_data: "cal_ignore" });
        }
        keyboard.push(currentWeek);
    }

    // Quick Action Buttons (More compact)
    keyboard.push([
        { text: "⚡ 3 Days", callback_data: "cal_quick_3days" },
        { text: "📅 1 Week", callback_data: "cal_quick_1week" },
        { text: "🌟 Any Date", callback_data: "cal_quick_any" }
    ]);

    return keyboard;
}

// 1. Send initial menu
export function sendDateSelectionMenu(bot: any, chatId: number) {
    dateRangeState.set(chatId, { step: 'awaiting_start', monthOffset: 0 });
    bot.sendMessage(chatId, "📅 *Step 1: Select START Date*\nOr use quick buttons:", {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: generateCalendarKeyboard(0, false)
        }
    });
}

// 2. Handle callbacks
export async function handleDateCalendarCallback(bot: any, chatId: number, data: string, queryId: string, messageId: number) {
    if (!data.startsWith("cal_")) return false; // Not our callback

    const state = dateRangeState.get(chatId) || { step: 'idle', monthOffset: 0 };

    if (data === "cal_ignore") {
        bot.answerCallbackQuery(queryId);
        return true;
    }

    // Month Navigation
    if (data.startsWith("cal_prev_") || data.startsWith("cal_next_")) {
        const isNext = data.startsWith("cal_next_");
        state.monthOffset += isNext ? 1 : -1;
        
        bot.editMessageReplyMarkup({
            inline_keyboard: generateCalendarKeyboard(state.monthOffset, state.step === 'awaiting_end')
        }, { chat_id: chatId, message_id: messageId });
        bot.answerCallbackQuery(queryId);
        return true;
    }

    // Quick Actions
    if (data.startsWith("cal_quick_")) {
        const today = new Date();
        state.startDate = new Date();
        
        if (data === "cal_quick_3days") {
            state.endDate = new Date(today.setDate(today.getDate() + 3));
            bot.sendMessage(chatId, `✅ *Range configured:* Next 3 days.\nSearching automatically...`, { parse_mode: "Markdown" });
        } else if (data === "cal_quick_1week") {
            state.endDate = new Date(today.setDate(today.getDate() + 7));
            bot.sendMessage(chatId, `✅ *Range configured:* Next week.\nSearching automatically...`, { parse_mode: "Markdown" });
        } else if (data === "cal_quick_any") {
            state.endDate = new Date(today.setFullYear(today.getFullYear() + 1)); // 1 year ahead = any
            bot.sendMessage(chatId, `✅ *Range configured:* Any available date.\nSearching automatically...`, { parse_mode: "Markdown" });
        }
        
        state.step = 'completed';
        bot.deleteMessage(chatId, messageId).catch(()=>{});
        bot.answerCallbackQuery(queryId);
        
        // Check if we are in Fast Mode flow
        import('../fastmode/chatState.js').then(chatStateMod => {
            if (chatStateMod.fastBookingStates.has(chatId)) {
                import('../fastmode/fastChatMenu.js').then(fastMenu => {
                    fastMenu.showFastModeSummary(bot, chatId);
                });
            }
        }).catch(()=>{});
        return true;
    }

    // Day Selection
    if (data.startsWith("cal_day_")) {
        const dateStr = data.replace("cal_day_", ""); // YYYY-MM-DD
        const selectedDate = new Date(dateStr);

        if (state.step === 'awaiting_start') {
            state.startDate = selectedDate;
            state.step = 'awaiting_end';
            
            bot.editMessageText(`📅 *Step 2: Select END Date*\n\nSelected Start: ${dateStr}`, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: generateCalendarKeyboard(state.monthOffset, true)
                }
            });
        } else if (state.step === 'awaiting_end') {
            state.endDate = selectedDate;
            state.step = 'completed';

            // Ensure start date is before end date
            if (state.startDate && state.endDate < state.startDate) {
                const temp = state.startDate;
                state.startDate = state.endDate;
                state.endDate = temp;
            }

            const startStr = state.startDate?.toISOString().split('T')[0];
            const endStr = state.endDate.toISOString().split('T')[0];

            bot.editMessageText(`✅ *Range Configured Successfully:*\nFrom: ${startStr}\nTo: ${endStr}\n\nThe bot will now search for dates within this range.`, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: "Markdown"
            });
            
            // Check if we are in Fast Mode flow
            import('../fastmode/chatState.js').then(chatStateMod => {
                if (chatStateMod.fastBookingStates.has(chatId)) {
                    import('../fastmode/fastChatMenu.js').then(fastMenu => {
                        fastMenu.showFastModeSummary(bot, chatId);
                    });
                }
            }).catch(()=>{});
        }

        bot.answerCallbackQuery(queryId);
        return true;
    }

    return false;
}
