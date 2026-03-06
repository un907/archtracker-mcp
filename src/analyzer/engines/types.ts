import type { DependencyGraph } from "../../types/schema.js";

export type LanguageId =
  | "javascript"
  | "python"
  | "rust"
  | "go"
  | "java"
  | "c-cpp"
  | "c-sharp"
  | "ruby"
  | "php"
  | "swift"
  | "kotlin"
  | "dart"
  | "scala";

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

export type CommentStyle =
  | "c-style"       // // and /* */
  | "hash"          // #
  | "python"        // # and """ / '''
  | "ruby"          // # and =begin/=end
  | "php";          // //, /* */, and #

export interface LanguageConfig {
  id: LanguageId;
  extensions: string[];
  importPatterns: ImportPattern[];
  resolveImport: ImportResolver;
  commentStyle: CommentStyle;
  defaultExclude?: string[];
  /** Custom import extractor for languages with complex syntax (e.g. Rust grouped use) */
  extractImports?: (content: string) => string[];
}
