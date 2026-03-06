import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { LANGUAGE_IDS } from "./types.js";
import type { LanguageConfig, LanguageId } from "./types.js";

// ─── Python ──────────────────────────────────────────
const python: LanguageConfig = {
  id: "python",
  extensions: [".py"],
  commentStyle: "python",
  importPatterns: [
    // from package.module import something
    { regex: /^from\s+(\.[\w.]*|\w[\w.]*)\s+import\b/gm },
    // import package.module (handled by extractImports for multi-module case)
  ],
  // Bug #1 fix: custom extractImports to handle `import a, b, c`
  extractImports(content: string): string[] {
    const imports: string[] = [];

    // from package.module import something
    const fromRegex = /^from\s+(\.[\w.]*|\w[\w.]*)\s+import\b/gm;
    let match: RegExpExecArray | null;
    while ((match = fromRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // import a, b, c — captures all comma-separated modules
    const importRegex = /^import\s+([\w.]+(?:\s*,\s*[\w.]+)*)/gm;
    while ((match = importRegex.exec(content)) !== null) {
      const modules = match[1].split(",");
      for (const mod of modules) {
        const trimmed = mod.trim();
        if (trimmed) imports.push(trimmed);
      }
    }

    return imports;
  },
  resolveImport(importPath, sourceFile, rootDir, projectFiles) {
    // Relative imports (starts with .)
    if (importPath.startsWith(".")) {
      const dots = importPath.match(/^\.+/)?.[0].length ?? 1;
      let base = dirname(sourceFile);
      for (let i = 1; i < dots; i++) base = dirname(base);
      const rest = importPath.slice(dots).replace(/\./g, "/");
      return tryPythonResolve(join(base, rest), projectFiles);
    }
    // Absolute imports
    const parts = importPath.replace(/\./g, "/");
    return tryPythonResolve(join(rootDir, parts), projectFiles);
  },
  defaultExclude: ["__pycache__", "\\.venv", "venv", "\\.egg-info", "dist", "build"],
};

function tryPythonResolve(base: string, projectFiles: Set<string>): string | null {
  // Try as module file
  if (projectFiles.has(base + ".py")) return base + ".py";
  // Try as package __init__.py
  if (projectFiles.has(join(base, "__init__.py"))) return join(base, "__init__.py");
  return null;
}

// ─── Rust ────────────────────────────────────────────
const rust: LanguageConfig = {
  id: "rust",
  extensions: [".rs"],
  commentStyle: "c-style",
  importPatterns: [], // handled by extractImports
  extractImports(content: string): string[] {
    const imports: string[] = [];

    // mod declarations: mod child;
    const modRegex = /\bmod\s+(\w+)\s*;/gm;
    let match: RegExpExecArray | null;
    while ((match = modRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // use crate::... (simple and grouped)
    const useRegex = /\buse\s+crate::([\s\S]*?);/gm;
    while ((match = useRegex.exec(content)) !== null) {
      const body = match[1].trim();
      extractRustUsePaths(body, "", imports);
    }

    // Bug #2 fix: use super::... imports
    const useSuperRegex = /\buse\s+super::([\s\S]*?);/gm;
    while ((match = useSuperRegex.exec(content)) !== null) {
      const body = match[1].trim();
      extractRustUsePaths(body, "", imports, "super");
    }

    // Bug #2 fix: use self::... imports
    const useSelfRegex = /\buse\s+self::([\s\S]*?);/gm;
    while ((match = useSelfRegex.exec(content)) !== null) {
      const body = match[1].trim();
      extractRustUsePaths(body, "", imports, "self");
    }

    return imports;
  },
  resolveImport(importPath, sourceFile, rootDir, projectFiles) {
    const srcDir = join(rootDir, "src");

    if (!importPath.includes("::")) {
      // mod declaration: look for child module
      const parentDir = dirname(sourceFile);
      const asFile = join(parentDir, importPath + ".rs");
      if (projectFiles.has(asFile)) return asFile;
      const asDir = join(parentDir, importPath, "mod.rs");
      if (projectFiles.has(asDir)) return asDir;
      return null;
    }

    // Bug #3 fix: use super::x::y — resolve from parent directory of source file
    if (importPath.startsWith("super::")) {
      const parentDir = dirname(dirname(sourceFile));
      const segments = importPath.slice("super::".length).split("::");
      for (let i = segments.length; i > 0; i--) {
        const path = segments.slice(0, i).join("/");
        const asFile = join(parentDir, path + ".rs");
        if (projectFiles.has(asFile)) return asFile;
        const asDir = join(parentDir, path, "mod.rs");
        if (projectFiles.has(asDir)) return asDir;
      }
      return null;
    }

    // Bug #4 fix: use self::x::y — resolve from same directory as source file
    if (importPath.startsWith("self::")) {
      const selfDir = dirname(sourceFile);
      const segments = importPath.slice("self::".length).split("::");
      for (let i = segments.length; i > 0; i--) {
        const path = segments.slice(0, i).join("/");
        const asFile = join(selfDir, path + ".rs");
        if (projectFiles.has(asFile)) return asFile;
        const asDir = join(selfDir, path, "mod.rs");
        if (projectFiles.has(asDir)) return asDir;
      }
      return null;
    }

    // use crate::x::y — resolve from src/
    const segments = importPath.split("::");
    // Try progressively shorter prefixes as directory/file
    for (let i = segments.length; i > 0; i--) {
      const path = segments.slice(0, i).join("/");
      const asFile = join(srcDir, path + ".rs");
      if (projectFiles.has(asFile)) return asFile;
      const asDir = join(srcDir, path, "mod.rs");
      if (projectFiles.has(asDir)) return asDir;
    }
    return null;
  },
  defaultExclude: ["target"],
};

/**
 * Recursively extract Rust use paths, handling grouped imports.
 * e.g. "foo::{bar, baz::qux}" → ["foo::bar", "foo::baz::qux"]
 * e.g. "foo::bar" → ["foo::bar"]
 * The optional rootPrefix parameter prepends "super" or "self" to all paths.
 */
function extractRustUsePaths(body: string, prefix: string, results: string[], rootPrefix?: string): void {
  const trimmed = body.trim();

  // Check for grouped import: path::{...}
  const braceStart = trimmed.indexOf("{");
  if (braceStart === -1) {
    // Simple path like "foo::bar::Baz" or just "foo"
    let path = prefix ? `${prefix}::${trimmed}` : trimmed;
    if (rootPrefix) {
      path = `${rootPrefix}::${path}`;
    }
    // Remove trailing items after last :: that aren't module names
    // Keep the full path — resolver handles progressively shorter prefixes
    if (path && !path.includes("{")) {
      results.push(path);
    }
    return;
  }

  // Extract the prefix before the brace
  let pathPrefix = trimmed.slice(0, braceStart).trim();
  if (pathPrefix.endsWith("::")) {
    pathPrefix = pathPrefix.slice(0, -2);
  }
  const fullPrefix = prefix ? `${prefix}::${pathPrefix}` : pathPrefix;

  // Find matching closing brace
  let depth = 0;
  let braceEnd = -1;
  for (let i = braceStart; i < trimmed.length; i++) {
    if (trimmed[i] === "{") depth++;
    else if (trimmed[i] === "}") {
      depth--;
      if (depth === 0) { braceEnd = i; break; }
    }
  }
  if (braceEnd === -1) return;

  // Split the brace content by commas (respecting nested braces)
  const inner = trimmed.slice(braceStart + 1, braceEnd).trim();
  const items = splitByTopLevelComma(inner);

  for (const item of items) {
    const cleaned = item.trim();
    if (cleaned === "self") {
      const selfPath = rootPrefix ? `${rootPrefix}::${fullPrefix}` : fullPrefix;
      results.push(selfPath);
    } else if (cleaned) {
      extractRustUsePaths(cleaned, fullPrefix, results, rootPrefix);
    }
  }
}

/** Split string by commas, respecting nested braces */
function splitByTopLevelComma(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") depth--;
    else if (s[i] === "," && depth === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(s.slice(start));
  return parts;
}

// ─── Go ──────────────────────────────────────────────
const go: LanguageConfig = {
  id: "go",
  extensions: [".go"],
  commentStyle: "c-style",
  importPatterns: [], // handled by extractImports
  extractImports(content: string): string[] {
    const imports: string[] = [];

    // Single import: import "path" or import alias "path"
    const singleRegex = /\bimport\s+(?:\w+\s+)?"([^"]+)"/gm;
    let match: RegExpExecArray | null;
    while ((match = singleRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Import block: import ( ... )
    const blockRegex = /\bimport\s*\(([^)]*)\)/gms;
    while ((match = blockRegex.exec(content)) !== null) {
      const block = match[1];
      const entryRegex = /(?:\w+\s+)?"([^"]+)"/g;
      let entry: RegExpExecArray | null;
      while ((entry = entryRegex.exec(block)) !== null) {
        imports.push(entry[1]);
      }
    }

    return imports;
  },
  resolveImport(importPath, _sourceFile, rootDir, projectFiles) {
    // Only resolve project-internal imports
    // Read go.mod module path to strip prefix
    const modPrefix = goModulePrefix(rootDir);
    if (!modPrefix || !importPath.startsWith(modPrefix)) return null;

    const relPath = importPath.slice(modPrefix.length + 1); // +1 for /
    // Go packages are directories; find any .go file in the directory
    const pkgDir = join(rootDir, relPath);
    for (const f of projectFiles) {
      if (f.startsWith(pkgDir + "/") && f.endsWith(".go")) return f;
    }
    return null;
  },
  defaultExclude: ["vendor"],
};

// Bug #11: goModCache is a per-process cache of go.mod module prefixes, keyed by rootDir.
// It is intentionally never cleared because the module path for a given rootDir does not
// change during the lifetime of a single process. If a long-running process needs to pick
// up go.mod changes, restart the process.
const goModCache = new Map<string, string | null>();
function goModulePrefix(rootDir: string): string | null {
  if (goModCache.has(rootDir)) return goModCache.get(rootDir)!;
  try {
    const content = readFileSync(join(rootDir, "go.mod"), "utf-8");
    const match = content.match(/^module\s+(.+)$/m);
    const prefix = match ? match[1].trim() : null;
    goModCache.set(rootDir, prefix);
    return prefix;
  } catch {
    goModCache.set(rootDir, null);
    return null;
  }
}

// ─── Java ────────────────────────────────────────────
const java: LanguageConfig = {
  id: "java",
  extensions: [".java"],
  commentStyle: "c-style",
  importPatterns: [
    // Bug #5 fix: import com.example.ClassName; and import com.example.*; (wildcard)
    // Bug #6: static imports also captured here
    { regex: /^import\s+(?:static\s+)?([\w.*]+);/gm },
  ],
  resolveImport(importPath, _sourceFile, rootDir, projectFiles) {
    // Bug #5 fix: wildcard imports — can't resolve to a single file, return null
    if (importPath.endsWith(".*")) {
      return null;
    }

    // Bug #6 fix: static imports — try progressively shorter paths
    // e.g. com.example.Class.method → try com/example/Class/method.java,
    // then com/example/Class.java, then com/example.java, etc.
    const segments = importPath.split(".");
    for (let i = segments.length; i > 0; i--) {
      const filePath = segments.slice(0, i).join("/") + ".java";
      for (const srcRoot of ["", "src/main/java/", "src/", "app/src/main/java/"]) {
        const full = join(rootDir, srcRoot, filePath);
        if (projectFiles.has(full)) return full;
      }
    }
    return null;
  },
  defaultExclude: ["build", "target", "\\.gradle", "\\.idea"],
};

// ─── C/C++ ───────────────────────────────────────────
const cCpp: LanguageConfig = {
  id: "c-cpp",
  extensions: [".c", ".cpp", ".cc", ".cxx", ".h", ".hpp"],
  commentStyle: "c-style",
  importPatterns: [
    // #include "file.h" (skip <system> includes)
    { regex: /^#include\s+"([^"]+)"/gm },
  ],
  resolveImport(importPath, sourceFile, rootDir, projectFiles) {
    // Resolve relative to source file first
    const fromSource = resolve(dirname(sourceFile), importPath);
    if (projectFiles.has(fromSource)) return fromSource;
    // Then relative to root
    const fromRoot = join(rootDir, importPath);
    if (projectFiles.has(fromRoot)) return fromRoot;
    // Try common include dirs
    for (const incDir of ["include", "src"]) {
      const full = join(rootDir, incDir, importPath);
      if (projectFiles.has(full)) return full;
    }
    return null;
  },
  defaultExclude: ["build", "cmake-build", "\\.o$", "\\.obj$"],
};

// ─── Ruby ────────────────────────────────────────────
const ruby: LanguageConfig = {
  id: "ruby",
  extensions: [".rb"],
  commentStyle: "ruby",
  importPatterns: [
    // require_relative 'path'
    { regex: /\brequire_relative\s+['"]([^'"]+)['"]/gm },
    // require 'path' (for project-internal requires)
    { regex: /\brequire\s+['"]([^'"]+)['"]/gm },
  ],
  resolveImport(importPath, sourceFile, rootDir, projectFiles) {
    const withExt = importPath.endsWith(".rb") ? importPath : importPath + ".rb";
    // require_relative: relative to source
    const fromSource = resolve(dirname(sourceFile), withExt);
    if (projectFiles.has(fromSource)) return fromSource;
    // require: relative to root or lib/
    const fromRoot = join(rootDir, withExt);
    if (projectFiles.has(fromRoot)) return fromRoot;
    const fromLib = join(rootDir, "lib", withExt);
    if (projectFiles.has(fromLib)) return fromLib;
    return null;
  },
  defaultExclude: ["vendor", "\\.bundle"],
};

// ─── PHP ─────────────────────────────────────────────
const php: LanguageConfig = {
  id: "php",
  extensions: [".php"],
  commentStyle: "php",
  importPatterns: [
    // require/include/require_once/include_once 'path'
    { regex: /\b(?:require|include)(?:_once)?\s+['"]([^'"]+)['"]/gm },
    // Bug #9 fix: use Namespace\Class — skip `function` and `const` keywords
    { regex: /^use\s+(?:function\s+|const\s+)?([\w\\]+)/gm },
  ],
  resolveImport(importPath, sourceFile, rootDir, projectFiles) {
    // Direct file path
    if (importPath.includes("/") || importPath.endsWith(".php")) {
      const withExt = importPath.endsWith(".php") ? importPath : importPath + ".php";
      const fromSource = resolve(dirname(sourceFile), withExt);
      if (projectFiles.has(fromSource)) return fromSource;
      const fromRoot = join(rootDir, withExt);
      if (projectFiles.has(fromRoot)) return fromRoot;
      return null;
    }
    // PSR-4: Namespace\Class → Namespace/Class.php
    const filePath = importPath.replace(/\\/g, "/") + ".php";
    const fromRoot = join(rootDir, filePath);
    if (projectFiles.has(fromRoot)) return fromRoot;
    const fromSrc = join(rootDir, "src", filePath);
    if (projectFiles.has(fromSrc)) return fromSrc;
    return null;
  },
  defaultExclude: ["vendor"],
};

// ─── Swift ───────────────────────────────────────────
const swift: LanguageConfig = {
  id: "swift",
  extensions: [".swift"],
  commentStyle: "c-style",
  importPatterns: [
    // Bug #10 fix: import ModuleName and @testable import ModuleName
    { regex: /^(?:@testable\s+)?import\s+(?:class\s+|struct\s+|enum\s+|protocol\s+|func\s+|var\s+|let\s+|typealias\s+)?(\w+)/gm },
  ],
  resolveImport(importPath, sourceFile, rootDir, projectFiles) {
    // Cross-module: import Module → find Sources/Module/*.swift
    const spmDir = join(rootDir, "Sources", importPath);
    // Return the first .swift file in the target module directory
    for (const f of projectFiles) {
      if (f.startsWith(spmDir + "/") && f.endsWith(".swift")) return f;
    }
    return null;
  },
  defaultExclude: ["\\.build", "DerivedData"],
};

// ─── Kotlin ──────────────────────────────────────────
const kotlin: LanguageConfig = {
  id: "kotlin",
  extensions: [".kt", ".kts"],
  commentStyle: "c-style",
  importPatterns: [
    // Bug #7/#8 fix: import com.example.ClassName and import com.example.*
    { regex: /^import\s+([\w.*]+)/gm },
  ],
  resolveImport(importPath, _sourceFile, rootDir, projectFiles) {
    // Bug #8 fix: wildcard imports — can't resolve to a single file, return null
    if (importPath.endsWith(".*")) {
      return null;
    }

    // Bug #7 fix: strip trailing dot if present (from previous regex issues)
    let cleanPath = importPath;
    if (cleanPath.endsWith(".")) {
      cleanPath = cleanPath.slice(0, -1);
    }

    // Convert com.example.Class to com/example/Class.kt
    const filePath = cleanPath.replace(/\./g, "/");
    for (const ext of [".kt", ".kts"]) {
      for (const srcRoot of [
        "",
        "src/main/kotlin/",
        "src/main/java/",
        "src/",
        "app/src/main/kotlin/",
        "app/src/main/java/",
      ]) {
        const full = join(rootDir, srcRoot, filePath + ext);
        if (projectFiles.has(full)) return full;
      }
    }
    return null;
  },
  defaultExclude: ["build", "\\.gradle", "\\.idea"],
};

// ─── C# ──────────────────────────────────────────────
const cSharp: LanguageConfig = {
  id: "c-sharp",
  extensions: [".cs"],
  commentStyle: "c-style",
  importPatterns: [
    // using Namespace; and using Namespace.SubNamespace;
    // using static Namespace.Class;
    // Skip: using Alias = Namespace.Class; (captured but resolved same way)
    { regex: /^using\s+(?:static\s+)?([\w.]+)\s*;/gm },
  ],
  resolveImport(importPath, _sourceFile, rootDir, projectFiles) {
    const segments = importPath.split(".");

    // 1. Try as direct file path (progressively shorter, like Java static imports)
    for (let i = segments.length; i > 0; i--) {
      const filePath = segments.slice(0, i).join("/") + ".cs";
      for (const srcRoot of ["", "src/", "lib/"]) {
        const full = join(rootDir, srcRoot, filePath);
        if (projectFiles.has(full)) return full;
      }
    }

    // 2. C# using = namespace import; try as directory, find first .cs file
    //    Strip leading segments progressively (handles root namespace prefix)
    for (let start = 0; start < segments.length; start++) {
      const dirPath = segments.slice(start).join("/");
      for (const srcRoot of ["", "src/", "lib/"]) {
        const prefix = join(rootDir, srcRoot, dirPath) + "/";
        for (const f of projectFiles) {
          if (f.startsWith(prefix) && f.endsWith(".cs")) return f;
        }
      }
    }

    return null;
  },
  defaultExclude: ["bin", "obj", "\\.vs", "packages", "TestResults"],
};

// ─── Dart ────────────────────────────────────────────
const dart: LanguageConfig = {
  id: "dart",
  extensions: [".dart"],
  commentStyle: "c-style",
  importPatterns: [
    // import 'package:pkg/file.dart'; or import 'relative/path.dart';
    { regex: /^import\s+['"]([^'"]+)['"]/gm },
    // export 'file.dart'; (re-exports create dependencies too)
    { regex: /^export\s+['"]([^'"]+)['"]/gm },
  ],
  resolveImport(importPath, sourceFile, rootDir, projectFiles) {
    // Skip dart: stdlib imports
    if (importPath.startsWith("dart:")) return null;

    // package: imports — resolve own package to lib/
    if (importPath.startsWith("package:")) {
      const ownPackage = dartPackageName(rootDir);
      if (!ownPackage) return null;
      const prefix = `package:${ownPackage}/`;
      if (!importPath.startsWith(prefix)) return null; // external package
      const relPath = importPath.slice(prefix.length);
      const full = join(rootDir, "lib", relPath);
      if (projectFiles.has(full)) return full;
      return null;
    }

    // Relative imports
    const resolved = resolve(dirname(sourceFile), importPath);
    if (projectFiles.has(resolved)) return resolved;
    return null;
  },
  defaultExclude: ["\\.dart_tool", "build", "\\.packages"],
};

const dartPackageCache = new Map<string, string | null>();
function dartPackageName(rootDir: string): string | null {
  if (dartPackageCache.has(rootDir)) return dartPackageCache.get(rootDir)!;
  try {
    const content = readFileSync(join(rootDir, "pubspec.yaml"), "utf-8");
    const match = content.match(/^name:\s*(\S+)/m);
    const name = match ? match[1] : null;
    dartPackageCache.set(rootDir, name);
    return name;
  } catch {
    dartPackageCache.set(rootDir, null);
    return null;
  }
}

// ─── Scala ───────────────────────────────────────────
const scala: LanguageConfig = {
  id: "scala",
  extensions: [".scala", ".sc"],
  commentStyle: "c-style",
  importPatterns: [],  // handled by extractImports for grouped syntax
  extractImports(content: string): string[] {
    const imports: string[] = [];
    // import pkg.Class
    // import pkg.{A, B, C}
    // import pkg._  (wildcard)
    const importRegex = /\bimport\s+([\w.]+(?:\.\{[^}]+\}|\.\w+|\._))/gm;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const full = match[1];
      // Check for grouped imports: import pkg.{A, B}
      const braceMatch = full.match(/^([\w.]+)\.\{([^}]+)\}$/);
      if (braceMatch) {
        const prefix = braceMatch[1];
        const items = braceMatch[2].split(",");
        for (const item of items) {
          const trimmed = item.trim().split(/\s+/)[0]; // handle "A => B" rename
          if (trimmed === "_") continue; // wildcard in group
          imports.push(`${prefix}.${trimmed}`);
        }
      } else if (full.endsWith("._")) {
        // Wildcard import — skip
        continue;
      } else {
        imports.push(full);
      }
    }
    return imports;
  },
  resolveImport(importPath, _sourceFile, rootDir, projectFiles) {
    const segments = importPath.split(".");
    // Try progressively shorter paths
    for (let i = segments.length; i > 0; i--) {
      const filePath = segments.slice(0, i).join("/");
      for (const ext of [".scala", ".sc"]) {
        for (const srcRoot of ["", "src/main/scala/", "src/", "app/"]) {
          const full = join(rootDir, srcRoot, filePath + ext);
          if (projectFiles.has(full)) return full;
        }
      }
    }
    return null;
  },
  defaultExclude: ["target", "\\.bsp", "\\.metals", "\\.bloop"],
};

// ─── JavaScript / TypeScript ──────────────────────────
const javascript: LanguageConfig = {
  id: "javascript",
  extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
  commentStyle: "c-style",
  importPatterns: [
    // ES6: import [type] [stuff from] "path"
    { regex: /import\s+(?:type\s+)?(?:[\w*{}\s,]+\s+from\s+)?["']([^"']+)["']/g },
    // Dynamic: import("path")
    { regex: /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g },
    // Re-export: export [type] { stuff } from "path" / export * from "path"
    { regex: /export\s+(?:type\s+)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s+from\s+["']([^"']+)["']/g },
    // CommonJS: require("path")
    { regex: /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g },
  ],
  resolveImport(importPath, sourceFile, rootDir, projectFiles) {
    // Skip external modules: node:, @scope/pkg, bare specifiers without ./ or ../
    if (importPath.startsWith("node:")) return null;
    if (!importPath.startsWith(".")) return null;

    // Resolve relative to source file
    const resolved = resolve(dirname(sourceFile), importPath);

    // 1. Exact match (e.g., "./foo.js" where foo.js actually exists)
    if (projectFiles.has(resolved)) return resolved;

    // 2. ESM convention: .js → .ts / .tsx (TypeScript emits .js in import paths)
    if (resolved.endsWith(".js")) {
      const tsPath = resolved.slice(0, -3) + ".ts";
      if (projectFiles.has(tsPath)) return tsPath;
      const tsxPath = resolved.slice(0, -3) + ".tsx";
      if (projectFiles.has(tsxPath)) return tsxPath;
    }
    if (resolved.endsWith(".jsx")) {
      const tsxPath = resolved.slice(0, -4) + ".tsx";
      if (projectFiles.has(tsxPath)) return tsxPath;
    }

    // 3. Try adding extensions
    for (const ext of [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]) {
      if (projectFiles.has(resolved + ext)) return resolved + ext;
    }

    // 4. Try as directory with index file
    for (const idx of ["/index.ts", "/index.tsx", "/index.js", "/index.jsx"]) {
      if (projectFiles.has(resolved + idx)) return resolved + idx;
    }

    return null;
  },
  defaultExclude: ["node_modules", "\\.d\\.ts$", "dist", "build", "coverage"],
};

// ─── Registry ────────────────────────────────────────
const LANGUAGE_CONFIGS: Record<LanguageId, LanguageConfig | null> = {
  javascript,
  python,
  rust,
  go,
  java,
  "c-cpp": cCpp,
  "c-sharp": cSharp,
  ruby,
  php,
  swift,
  kotlin,
  dart,
  scala,
};

export function getLanguageConfig(id: LanguageId): LanguageConfig | null {
  return LANGUAGE_CONFIGS[id] ?? null;
}

export function getAllLanguageIds(): LanguageId[] {
  return [...LANGUAGE_IDS];
}
