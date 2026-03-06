import { join, dirname, resolve } from "node:path";
import type { LanguageConfig, LanguageId } from "./types.js";

// ─── Python ──────────────────────────────────────────
const python: LanguageConfig = {
  id: "python",
  extensions: [".py"],
  importPatterns: [
    // from package.module import something
    { regex: /^from\s+(\.[\w.]*|\w[\w.]*)\s+import\b/gm },
    // import package.module
    { regex: /^import\s+([\w.]+)/gm },
  ],
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
  importPatterns: [
    // use crate::module::item;
    { regex: /\buse\s+crate::(\w[\w:]*)/gm },
    // mod child;
    { regex: /\bmod\s+(\w+)\s*;/gm },
  ],
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

// ─── Go ──────────────────────────────────────────────
const go: LanguageConfig = {
  id: "go",
  extensions: [".go"],
  importPatterns: [
    // import "path" or import ( "path" )
    { regex: /\bimport\s+(?:\w+\s+)?"([^"]+)"/gm },
    // import block entries
    { regex: /^\s+(?:\w+\s+)?"([^"]+)"/gm },
  ],
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

// Cache go.mod module prefix per rootDir
const goModCache = new Map<string, string | null>();
function goModulePrefix(rootDir: string): string | null {
  if (goModCache.has(rootDir)) return goModCache.get(rootDir)!;
  try {
    const fs = require("node:fs");
    const content = fs.readFileSync(join(rootDir, "go.mod"), "utf-8");
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
  importPatterns: [
    // import com.example.ClassName;
    { regex: /^import\s+(?:static\s+)?([\w.]+);/gm },
  ],
  resolveImport(importPath, _sourceFile, rootDir, projectFiles) {
    // Convert com.example.Class to com/example/Class.java
    const filePath = importPath.replace(/\./g, "/") + ".java";
    // Try common source roots
    for (const srcRoot of ["", "src/main/java/", "src/", "app/src/main/java/"]) {
      const full = join(rootDir, srcRoot, filePath);
      if (projectFiles.has(full)) return full;
    }
    return null;
  },
  defaultExclude: ["build", "target", "\\.gradle", "\\.idea"],
};

// ─── C/C++ ───────────────────────────────────────────
const cCpp: LanguageConfig = {
  id: "c-cpp",
  extensions: [".c", ".cpp", ".cc", ".cxx", ".h", ".hpp"],
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
  importPatterns: [
    // require/include/require_once/include_once 'path'
    { regex: /\b(?:require|include)(?:_once)?\s+['"]([^'"]+)['"]/gm },
    // use Namespace\Class (PSR-4 style)
    { regex: /^use\s+([\w\\]+)/gm },
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
  importPatterns: [
    // import ModuleName
    { regex: /^import\s+(?:class|struct|enum|protocol|func|var|let|typealias)?\s*(\w+)/gm },
  ],
  resolveImport(importPath, _sourceFile, rootDir, projectFiles) {
    // Swift imports are module-level; try to find a matching source directory
    // Check Sources/ModuleName/ pattern (SPM convention)
    const spmDir = join(rootDir, "Sources", importPath);
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
  importPatterns: [
    // import com.example.ClassName
    { regex: /^import\s+([\w.]+)/gm },
  ],
  resolveImport(importPath, _sourceFile, rootDir, projectFiles) {
    // Convert com.example.Class to com/example/Class.kt
    const filePath = importPath.replace(/\./g, "/");
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

// ─── Registry ────────────────────────────────────────
const LANGUAGE_CONFIGS: Record<LanguageId, LanguageConfig | null> = {
  javascript: null, // handled by DependencyCruiserEngine
  python,
  rust,
  go,
  java,
  "c-cpp": cCpp,
  ruby,
  php,
  swift,
  kotlin,
};

export function getLanguageConfig(id: LanguageId): LanguageConfig | null {
  return LANGUAGE_CONFIGS[id] ?? null;
}

export function getAllLanguageIds(): LanguageId[] {
  return Object.keys(LANGUAGE_CONFIGS) as LanguageId[];
}
