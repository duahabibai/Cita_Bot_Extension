export interface FastBookingState {
  step: 'province' | 'office' | 'tramite' | 'nie' | 'name' | 'phone' | 'email' | 'ready' | 'awaiting_profile_name';
  province?: { text: string; value: string };
  office?: { text: string; value: string };
  tramite?: { text: string; value: string };
  nie?: string;
  name?: string;
  phone?: string;
  email?: string;
}

export const fastBookingStates = new Map<number, FastBookingState>();
