import { resolve } from "node:path";
import { stat } from "node:fs/promises";
import type { DependencyGraph } from "../types/schema.js";
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
  /** Target language (auto-detected if omitted) */
  language?: LanguageId;
}

/**
 * Analyze project dependencies using regex-based import extraction.
 * Supports all 13 languages. Language is auto-detected if not specified.
 */
export async function analyzeProject(
  rootDir: string,
  options: AnalyzeOptions = {},
): Promise<DependencyGraph> {
  const absRootDir = resolve(rootDir);

  // Validate directory exists
  try {
    const s = await stat(absRootDir);
    if (!s.isDirectory()) {
      throw new AnalyzerError(`Not a directory: ${absRootDir}`);
    }
  } catch (error) {
    if (error instanceof AnalyzerError) throw error;
    throw new AnalyzerError(`Directory not found: ${absRootDir}`, { cause: error });
  }

  const language = options.language ?? (await detectLanguage(absRootDir));

  try {
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
