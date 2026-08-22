import { UserState, ActiveSession, TokenData } from './types.js';

export const userStates = new Map<number, UserState>();
export const activeSessions = new Map<number, ActiveSession>();

export let globalAutofillData = {
  phone: "0034634224788",
  email: "zeshuhere055@gmail.com",
  nie: "",
  name: "",
};

export function updateGlobalAutofillData(newData: Partial<typeof globalAutofillData>) {
  globalAutofillData = { ...globalAutofillData, ...newData };
}

export const tokens: { [key: string]: TokenData } = {};
export const authorizedMachines = new Set<string>();
export const pendingDurationForToken: Record<string, boolean> = {};
export const pendingNameForToken: Record<string, { duration: "week" | "month" }> = {};
export const pendingDataField: Record<string, string> = {};
