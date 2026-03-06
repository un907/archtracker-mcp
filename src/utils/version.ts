import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Read version from package.json at build/runtime — single source of truth */
function loadVersion(): string {
  // Walk up from this file to find package.json
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 5; i++) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
      return pkg.version;
    } catch {
      dir = dirname(dir);
    }
  }
  return "0.0.0";
}

export const VERSION = loadVersion();
