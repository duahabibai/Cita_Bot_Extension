import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a client-provided Playwright extraction script
 */
export async function validateScript(scriptPath: string): Promise<ValidationResult> {
  try {
    // 1. Check file exists
    if (!fs.existsSync(scriptPath)) {
      return { valid: false, error: "Script file not found" };
    }

    // 2. Check file size (max 5MB)
    const stats = fs.statSync(scriptPath);
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (stats.size > maxSize) {
      return {
        valid: false,
        error: `Script too large (${Math.round(stats.size / 1024)}KB). Max: 5MB`
      };
    }

    // 3. Check file extension
    const ext = path.extname(scriptPath).toLowerCase();
    if (![".js", ".mjs"].includes(ext)) {
      return { valid: false, error: "Script must be .js or .mjs file" };
    }

    // 4. Try to import and validate structure
    const fileUrl = pathToFileURL(scriptPath).href;
    let module;

    try {
      module = await import(fileUrl);
    } catch (syntaxError: any) {
      return {
        valid: false,
        error: `Script syntax error: ${syntaxError.message}`
      };
    }

    // 5. Check for required export
    if (typeof module.extract !== "function") {
      return {
        valid: false,
        error: "Script must export an 'extract' function: export async function extract(page) { ... }"
      };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: `Validation error: ${err.message}` };
  }
}

/**
 * Basic security scanning of script content
 */
export function scanScriptContent(scriptPath: string): { safe: boolean; warnings: string[] } {
  const content = fs.readFileSync(scriptPath, "utf8");
  const warnings: string[] = [];

  // Basic security checks
  const dangerousPatterns = [
    {
      pattern: /require\s*\(\s*['"]fs['"]\s*\)/,
      warning: "Script uses 'fs' module (file system access)"
    },
    {
      pattern: /require\s*\(\s*['"]child_process['"]\s*\)/,
      warning: "Script uses 'child_process' module"
    },
    {
      pattern: /process\.exit/,
      warning: "Script calls process.exit()"
    },
    {
      pattern: /eval\s*\(/,
      warning: "Script uses eval()"
    },
    {
      pattern: /import\s+.*\s+from\s+['"]fs['"]/,
      warning: "Script imports 'fs' module"
    },
    {
      pattern: /import\s+.*\s+from\s+['"]child_process['"]/,
      warning: "Script imports 'child_process' module"
    }
  ];

  for (const { pattern, warning } of dangerousPatterns) {
    if (pattern.test(content)) {
      warnings.push(warning);
    }
  }

  // Admin scripts are trusted, warnings are informational
  return { safe: warnings.length === 0, warnings };
}
