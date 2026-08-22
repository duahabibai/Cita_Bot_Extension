import TelegramBot from "node-telegram-bot-api";
import { UserState, ActiveSession } from "./types.js";

// These will be injected from server.ts to avoid circular dependencies
export let bot: TelegramBot;
export let activeSessions: Map<number, ActiveSession>;
export let userStates: Map<number, UserState>;
export let cleanupSession: (chatId: number) => void;
export let persistSessionState: (chatId: number) => Promise<void>;
export let PROXY_CONFIG: any;

export function initBotContext(
  b: TelegramBot,
  aS: Map<number, ActiveSession>,
  uS: Map<number, UserState>,
  cS: (chatId: number) => void,
  pS: (chatId: number) => Promise<void>,
  pC: any
) {
  bot = b;
  activeSessions = aS;
  userStates = uS;
  cleanupSession = cS;
  persistSessionState = pS;
  PROXY_CONFIG = pC;
}
