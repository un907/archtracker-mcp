import { resolve } from "node:path";
import type { DependencyGraph } from "../types/schema.js";
import { DependencyCruiserEngine } from "./engines/dependency-cruiser.js";
import { RegexEngine } from "./engines/regex-engine.js";
import { detectLanguage } from "./engines/detect.js";
import { getLanguageConfig } from "./engines/languages.js";
import type { LanguageId } from "./engines/types.js";

/** Options for the dependency analyzer */
export interface AnalyzeOptions {
  /** Regex patterns to exclude from analysis (e.g. ["node_modules", "\\.test\\.ts$"]) */
  exclude?: string[];
  /** Maximum recursion depth (0 = unlimited) */
  maxDepth?: number;
  /** Path to tsconfig.json (auto-detected if omitted) */
  tsConfigPath?: string;
  /** Include type-only imports (import type {...}) — JS/TS only */
  includeTypeOnly?: boolean;
  /** Target language (auto-detected if omitted) */
  language?: LanguageId;
}

/**
 * Analyze project dependencies.
 *
 * For JavaScript/TypeScript: uses dependency-cruiser (AST-based).
 * For other languages: uses regex-based import extraction.
 * Language is auto-detected from project marker files if not specified.
 */
export async function analyzeProject(
  rootDir: string,
  options: AnalyzeOptions = {},
): Promise<DependencyGraph> {
  const absRootDir = resolve(rootDir);
  const language = options.language ?? (await detectLanguage(absRootDir));

  try {
    if (language === "javascript") {
      return await new DependencyCruiserEngine().analyze(absRootDir, options);
    }

    const config = getLanguageConfig(language);
    if (!config) {
      throw new AnalyzerError(`No analyzer config for language: ${language}`);
    }

    return await new RegexEngine(config).analyze(absRootDir, options);
  } catch (error) {
    if (error instanceof AnalyzerError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new AnalyzerError(message, { cause: error });
  }
}

/** Custom error class for analyzer failures */
export class AnalyzerError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AnalyzerError";
  }
}
