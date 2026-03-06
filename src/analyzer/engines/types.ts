import type { DependencyGraph } from "../../types/schema.js";

export type LanguageId =
  | "javascript"
  | "python"
  | "rust"
  | "go"
  | "java"
  | "c-cpp"
  | "ruby"
  | "php"
  | "swift"
  | "kotlin";

export interface AnalyzerEngine {
  analyze(
    rootDir: string,
    options: { exclude?: string[]; maxDepth?: number },
  ): Promise<DependencyGraph>;
}

export interface ImportPattern {
  regex: RegExp;
}

export type ImportResolver = (
  importPath: string,
  sourceFile: string,
  rootDir: string,
  projectFiles: Set<string>,
) => string | null;

export interface LanguageConfig {
  id: LanguageId;
  extensions: string[];
  importPatterns: ImportPattern[];
  resolveImport: ImportResolver;
  defaultExclude?: string[];
}
