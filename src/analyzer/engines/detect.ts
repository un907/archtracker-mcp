import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { LanguageId } from "./types.js";

/** Marker files that identify a project's primary language */
const MARKERS: Array<{ file: string; language: LanguageId }> = [
  { file: "Cargo.toml", language: "rust" },
  { file: "go.mod", language: "go" },
  { file: "pyproject.toml", language: "python" },
  { file: "setup.py", language: "python" },
  { file: "requirements.txt", language: "python" },
  { file: "Pipfile", language: "python" },
  { file: "pom.xml", language: "java" },
  { file: "build.gradle", language: "java" },
  { file: "build.gradle.kts", language: "kotlin" },
  { file: "Package.swift", language: "swift" },
  { file: "Gemfile", language: "ruby" },
  { file: "composer.json", language: "php" },
  { file: "CMakeLists.txt", language: "c-cpp" },
  { file: "Makefile", language: "c-cpp" },
  { file: "package.json", language: "javascript" },
  { file: "tsconfig.json", language: "javascript" },
];

/** Extension-to-language mapping for fallback detection */
const EXT_MAP: Record<string, LanguageId> = {
  ".ts": "javascript",
  ".tsx": "javascript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".c": "c-cpp",
  ".cpp": "c-cpp",
  ".cc": "c-cpp",
  ".cxx": "c-cpp",
  ".h": "c-cpp",
  ".hpp": "c-cpp",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".kts": "kotlin",
};

/**
 * Auto-detect the primary language of a project directory.
 * 1. Check for marker files (Cargo.toml, go.mod, etc.)
 * 2. Fallback: count file extensions in the top-level directory
 */
export async function detectLanguage(rootDir: string): Promise<LanguageId> {
  // Phase 1: marker files
  for (const marker of MARKERS) {
    try {
      const s = await stat(join(rootDir, marker.file));
      if (s.isFile() || s.isDirectory()) {
        return marker.language;
      }
    } catch {
      // file doesn't exist, continue
    }
  }

  // Phase 2: extension frequency (shallow scan)
  const counts = new Map<LanguageId, number>();
  try {
    await scanExtensions(rootDir, counts, 2, 0);
  } catch {
    // if scan fails, default to JS
  }

  if (counts.size > 0) {
    let maxLang: LanguageId = "javascript";
    let maxCount = 0;
    for (const [lang, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        maxLang = lang;
      }
    }
    return maxLang;
  }

  return "javascript";
}

async function scanExtensions(
  dir: string,
  counts: Map<LanguageId, number>,
  maxDepth: number,
  currentDepth: number,
): Promise<void> {
  if (currentDepth >= maxDepth) return;

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

    if (entry.isDirectory() && currentDepth < maxDepth - 1) {
      await scanExtensions(
        join(dir, entry.name),
        counts,
        maxDepth,
        currentDepth + 1,
      );
    } else if (entry.isFile()) {
      const dotIdx = entry.name.lastIndexOf(".");
      if (dotIdx > 0) {
        const ext = entry.name.slice(dotIdx);
        const lang = EXT_MAP[ext];
        if (lang) {
          counts.set(lang, (counts.get(lang) ?? 0) + 1);
        }
      }
    }
  }
}
