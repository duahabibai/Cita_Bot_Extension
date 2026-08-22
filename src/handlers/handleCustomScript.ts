import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { bot, activeSessions } from "../botContext.js";
import { validateScript, scanScriptContent } from "./scriptValidator.js";

const EXTRACTION_SCRIPTS_DIR = path.resolve("./data/admin-extraction");

/**
 * Ensure the admin extraction directory exists
 */
function ensureExtractionDir() {
  if (!fs.existsSync(EXTRACTION_SCRIPTS_DIR)) {
    fs.mkdirSync(EXTRACTION_SCRIPTS_DIR, { recursive: true });
  }
}

/**
 * Get the script storage path for a specific admin/client
 */
export function getScriptPath(chatId: number): string {
  const clientDir = path.join(EXTRACTION_SCRIPTS_DIR, chatId.toString());
  if (!fs.existsSync(clientDir)) {
    fs.mkdirSync(clientDir, { recursive: true });
  }
  return path.join(clientDir, "extraction.mjs");
}

/**
 * Check if a custom extraction script exists for this admin
 */
export function hasCustomScript(chatId: number): boolean {
  const scriptPath = getScriptPath(chatId);
  return fs.existsSync(scriptPath);
}

/**
 * Handle admin uploading a custom extraction script
 */
export async function handleScriptUpload(
  chatId: number,
  fileName: string,
  fileBuffer: Buffer
): Promise<void> {
  console.log(`[ADMIN EXTRACTION] Admin ${chatId} uploaded script: ${fileName}`);

  try {
    ensureExtractionDir();

    // Validate file extension
    const ext = path.extname(fileName).toLowerCase();
    if (![".js", ".mjs"].includes(ext)) {
      await bot.sendMessage(
        chatId,
        "⚠️ Invalid file type. Please upload a `.js` or `.mjs` file.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Check file size
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (fileBuffer.length > maxSize) {
      await bot.sendMessage(
        chatId,
        `⚠️ File too large (${Math.round(fileBuffer.length / 1024)}KB). Maximum: 5MB`
      );
      return;
    }

    // Store the script
    const scriptPath = getScriptPath(chatId);
    fs.writeFileSync(scriptPath, fileBuffer);
    console.log(`[ADMIN EXTRACTION] Script stored at: ${scriptPath}`);

    await bot.sendMessage(chatId, "⏳ Validating extraction script...");

    // Validate the script
    const validation = await validateScript(scriptPath);
    if (!validation.valid) {
      console.log(`[ADMIN EXTRACTION] Validation failed: ${validation.error}`);
      // Delete invalid script
      fs.unlinkSync(scriptPath);
      await bot.sendMessage(
        chatId,
        `❌ Script validation failed:\n\n${validation.error}\n\nPlease fix and upload again.`
      );
      return;
    }

    // Security scan
    const scan = scanScriptContent(scriptPath);
    if (!scan.safe) {
      console.log(`[ADMIN EXTRACTION] Security warnings: ${scan.warnings.join(", ")}`);
      await bot.sendMessage(
        chatId,
        `⚠️ Security warnings detected:\n\n${scan.warnings.map(w => `• ${w}`).join("\n")}\n\nScript saved but please review.`,
        { parse_mode: "Markdown" }
      );
    }

    console.log(`[ADMIN EXTRACTION] Script validated successfully`);
    await bot.sendMessage(
      chatId,
      `✅ Extraction script uploaded and validated!\n\n` +
        `File: \`${fileName}\`\n` +
        `Stored as: \`extraction.mjs\`\n\n` +
        `To use it:\n` +
        `1. Click "💾 Admin: Scrape Data (Launch Browser)"\n` +
        `2. After browser loads, click "🤖 Run Custom Extraction"`,
      { parse_mode: "Markdown" }
    );
  } catch (err: any) {
    console.error(`[ADMIN EXTRACTION] Upload error:`, err);
    await bot.sendMessage(
      chatId,
      `❌ Error processing script: ${err.message}`
    );
  }
}

/**
 * Execute the custom extraction script against the existing Playwright page
 */
export async function executeCustomScript(chatId: number): Promise<void> {
  console.log(`[ADMIN EXTRACTION] Executing custom script for admin ${chatId}`);

  try {
    // Check if script exists
    if (!hasCustomScript(chatId)) {
      await bot.sendMessage(
        chatId,
        "⚠️ No custom extraction script found. Please upload one first."
      );
      return;
    }

    // Get the active session
    const session = activeSessions.get(chatId);
    if (!session || !session.page) {
      await bot.sendMessage(
        chatId,
        "⚠️ No active browser session. Please launch the browser first."
      );
      return;
    }

    const { page } = session;
    await bot.sendMessage(chatId, "🤖 Loading custom extraction script...");

    // Load the script
    const scriptPath = getScriptPath(chatId);
    const fileUrl = pathToFileURL(scriptPath).href;

    // Force reload by adding timestamp query param to avoid module cache
    const uniqueUrl = `${fileUrl}?t=${Date.now()}`;

    let module;
    try {
      module = await import(uniqueUrl);
    } catch (importErr: any) {
      console.error(`[ADMIN EXTRACTION] Import error:`, importErr);
      await bot.sendMessage(
        chatId,
        `❌ Failed to load script: ${importErr.message}`
      );
      return;
    }

    if (typeof module.extract !== "function") {
      await bot.sendMessage(
        chatId,
        "❌ Script does not export an 'extract' function."
      );
      return;
    }

    console.log(`[ADMIN EXTRACTION] Script loaded, executing extract(page)...`);
    await bot.sendMessage(chatId, "⏳ Running extraction logic...");

    // Execute the extraction with timeout
    const TIMEOUT = 120000; // 2 minutes
    let result;

    try {
      const extractionPromise = module.extract(page);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Extraction timeout (2 minutes)")), TIMEOUT)
      );

      result = await Promise.race([extractionPromise, timeoutPromise]);
    } catch (execErr: any) {
      console.error(`[ADMIN EXTRACTION] Execution error:`, execErr);
      await bot.sendMessage(
        chatId,
        `❌ Extraction failed: ${execErr.message}`
      );
      return;
    }

    console.log(`[ADMIN EXTRACTION] Extraction completed successfully`);

    // Format and send results
    const resultText = typeof result === "object"
      ? JSON.stringify(result, null, 2)
      : String(result);

    if (resultText.length > 4000) {
      // Send as file if too long
      const resultBuffer = Buffer.from(resultText, "utf8");
      await bot.sendDocument(chatId, resultBuffer, {
        caption: "✅ Custom extraction completed! Results attached."
      }, {
        filename: `extraction-result-${Date.now()}.json`
      });
    } else {
      await bot.sendMessage(
        chatId,
        `✅ Custom extraction completed!\n\n\`\`\`json\n${resultText}\n\`\`\``,
        { parse_mode: "Markdown" }
      );
    }

    // Take a screenshot of the final state
    try {
      const screenshot = await page.screenshot({
        timeout: 15000,
        type: "jpeg",
        quality: 40
      });
      await bot.sendPhoto(chatId, screenshot, {
        caption: "📸 Page state after extraction"
      });
    } catch (screenshotErr) {
      console.log("[ADMIN EXTRACTION] Screenshot failed (non-critical)");
    }
  } catch (err: any) {
    console.error(`[ADMIN EXTRACTION] Execution error:`, err);
    await bot.sendMessage(
      chatId,
      `❌ Error during extraction: ${err.message}`
    );
  }
}
