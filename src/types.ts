export interface UserState {
  province?: { text: string; value: string };
  office?: { text: string; value: string };
  tramite?: { text: string; value: string };
}

export interface ActiveSession {
  browser: any;
  context: any;
  page: any;
  timeoutId: NodeJS.Timeout;
  provinces?: { text: string; value: string }[];
  offices?: { text: string; value: string; selectId?: string; selectName?: string }[];
  tramites?: { text: string; value: string; selectId?: string; selectName?: string }[];
  dynamicButtons?: { text: string; selector: string; index: number }[];
}

export type TokenData = {
  used: boolean;
  machineId?: string;
  assignedTo?: string;
  usedAt?: number;
  duration?: "week" | "month";
  expiresAt?: number;
};
