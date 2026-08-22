import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DB_PATH = path.resolve('./fastmode_db.json');

export interface ProvinceData {
  text: string;
  value: string;
}

export interface OfficeData {
  text: string;
  value: string;
}

export interface TramiteData {
  text: string;
  value: string;
}

export interface ProfileData {
  id: string;
  name: string; // The user-provided name for the draft
  province?: ProvinceData;
  office?: OfficeData;
  tramite?: TramiteData;
  nie?: string;
  userName?: string;
  phone?: string;
  email?: string;
  // We can optionally store date range info if needed, but simple string is fine for now
}

export interface AppDatabase {
  provinces: ProvinceData[];
  offices: Record<string, OfficeData[]>; // province value -> offices
  tramites: Record<string, TramiteData[]>; // province value -> tramites
  profiles?: ProfileData[]; // Draft profiles
}

export function loadFastDb(): AppDatabase {
  if (fs.existsSync(DB_PATH)) {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    try {
      const db = JSON.parse(raw);
      if (!db.profiles) db.profiles = [];
      return db;
    } catch (e) {
      return { provinces: [], offices: {}, tramites: {}, profiles: [] };
    }
  }
  return { provinces: [], offices: {}, tramites: {}, profiles: [] };
}

export function saveFastDb(db: AppDatabase) {
  if (!db.profiles) db.profiles = [];
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
