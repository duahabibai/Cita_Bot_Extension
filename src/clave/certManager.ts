import fs from "fs";
import path from "path";
import crypto from "crypto";

// CRITICAL: Following CLAUDE.md structure requirements
const CLIENTS_DIR = path.resolve("./clients");
const ALGORITHM = "aes-256-cbc";
const ENCRYPTION_KEY = process.env.CERT_ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex").slice(0, 32);

/**
 * Get the clave directory for a chat: clients/<chat_id>/clave/
 */
function claveDir(chatId: number): string {
  const dir = path.join(CLIENTS_DIR, String(chatId), "clave");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Get the temp directory for a chat: clients/<chat_id>/clave/temp/
 */
function tempDir(chatId: number): string {
  const dir = path.join(claveDir(chatId), "temp");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Check if user has saved certificate
 * CRITICAL: The original certificate is always named "certificate.p12"
 */
export function hasSavedCert(chatId: number): boolean {
  const certPath = path.join(claveDir(chatId), "certificate.p12");
  return fs.existsSync(certPath);
}

/**
 * Check if user has saved password
 */
export function hasSavedPassword(chatId: number): boolean {
  const pwFile = path.join(claveDir(chatId), "encrypted_password");
  return fs.existsSync(pwFile);
}

/**
 * Get the path to the ORIGINAL certificate
 * CRITICAL: This is always clients/<chat_id>/clave/certificate.p12
 * This file must NEVER be deleted, moved, or overwritten destructively
 */
export function getP12Path(chatId: number): string | null {
  const certPath = path.join(claveDir(chatId), "certificate.p12");
  if (!fs.existsSync(certPath)) return null;
  return certPath;
}

/**
 * Save the P12 certificate
 * CRITICAL: Always saves as "certificate.p12" - the PERMANENT original
 * If a certificate already exists, this overwrites it (user is uploading a new one)
 * This is the ONLY time we write to certificate.p12
 */
export function saveP12(chatId: number, buffer: Buffer, filename: string): string {
  const dir = claveDir(chatId);
  // CRITICAL: Always save as "certificate.p12" - this is the permanent original
  const dest = path.join(dir, "certificate.p12");
  fs.writeFileSync(dest, buffer);
  console.log(`[CertManager] Saved ORIGINAL certificate for chat ${chatId}: ${dest}`);
  return dest;
}

/**
 * Save encrypted password
 */
export function savePassword(chatId: number, password: string): void {
  const dir = claveDir(chatId);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "utf8"), iv);
  let encrypted = cipher.update(password, "utf8", "hex");
  encrypted += cipher.final("hex");
  const payload = iv.toString("hex") + ":" + encrypted;
  const pwFile = path.join(dir, "encrypted_password");
  fs.writeFileSync(pwFile, payload, "utf8");
  console.log(`[CertManager] Saved encrypted password for chat ${chatId}`);
}

/**
 * Get decrypted password
 */
export function getPassword(chatId: number): string | null {
  const pwFile = path.join(claveDir(chatId), "encrypted_password");
  if (!fs.existsSync(pwFile)) return null;

  try {
    const raw = fs.readFileSync(pwFile, "utf8").trim();
    const [ivHex, encrypted] = raw.split(":");
    if (!ivHex || !encrypted) {
      console.error(`[CertManager] Invalid password file format for chat ${chatId}`);
      // Delete corrupted file
      fs.unlinkSync(pwFile);
      return null;
    }
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "utf8"), iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error: any) {
    console.error(`[CertManager] Failed to decrypt password for chat ${chatId}:`, error.message);
    // Delete corrupted file so user can re-enter password
    try {
      fs.unlinkSync(pwFile);
      console.log(`[CertManager] Deleted corrupted password file for chat ${chatId}`);
    } catch (e) {
      console.error(`[CertManager] Failed to delete corrupted password file:`, e);
    }
    return null;
  }
}

/**
 * Get client certificate for Playwright
 * CRITICAL: Returns path to the ORIGINAL certificate
 * Playwright will read from this file - we NEVER move or delete it
 */
export function getClientCertificate(chatId: number): { p12Path: string; password: string } | null {
  const p12 = getP12Path(chatId);
  const pw = getPassword(chatId);
  if (!p12 || !pw) return null;
  return { p12Path: p12, password: pw };
}

/**
 * Create a temporary copy of the certificate if needed
 * CRITICAL: This creates a COPY in the temp/ directory
 * The original certificate.p12 is NEVER touched
 * Temporary files in temp/ can be safely deleted
 */
export function createTempCertCopy(chatId: number): string | null {
  const originalPath = getP12Path(chatId);
  if (!originalPath) return null;

  const temp = tempDir(chatId);
  const tempCertPath = path.join(temp, `temp_${Date.now()}.p12`);

  // CRITICAL: Copy the original, never move it
  fs.copyFileSync(originalPath, tempCertPath);
  console.log(`[CertManager] Created temporary certificate copy: ${tempCertPath}`);

  return tempCertPath;
}

/**
 * Clean up temporary files
 * CRITICAL: Only deletes files in the temp/ directory
 * The original certificate.p12 is NEVER deleted
 */
export function cleanupTempFiles(chatId: number): void {
  const temp = tempDir(chatId);
  if (!fs.existsSync(temp)) return;

  const files = fs.readdirSync(temp);
  for (const file of files) {
    const filePath = path.join(temp, file);
    try {
      fs.unlinkSync(filePath);
      console.log(`[CertManager] Cleaned up temp file: ${filePath}`);
    } catch (e) {
      console.error(`[CertManager] Failed to delete temp file ${filePath}:`, e);
    }
  }
}
