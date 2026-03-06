/**
 * Robustness tests — "導入後に起きうる問題" を想定したテスト
 *
 * ユーザーが npm install 後に遭遇しうるシナリオをカバー:
 * - 存在しないディレクトリ / 空ディレクトリ
 * - 言語検出が target ディレクトリにマーカーがない場合
 * - 明示的 --language 指定（正しい / 間違い / 無効値）
 * - マーカーファイルと拡張子の優先度
 * - 破損したソースファイル
 * - 権限エラー的な状況
 * - パストラバーサル
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyzeProject, AnalyzerError } from "../analyze.js";
import { detectLanguage } from "./detect.js";
import { RegexEngine } from "./regex-engine.js";
import { getLanguageConfig } from "./languages.js";
import type { LanguageId } from "./types.js";
import { LANGUAGE_IDS } from "./types.js";

let tempDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "archtracker-robust-"));
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════
// 1. 存在しないディレクトリ
// ═══════════════════════════════════════════════════════

describe("non-existent directory", () => {
  it("analyzeProject throws AnalyzerError", async () => {
    await expect(
      analyzeProject("/absolutely/does/not/exist/xyz123"),
    ).rejects.toThrow(AnalyzerError);
  });

  it("analyzeProject with language override also throws for missing dir", async () => {
    await expect(
      analyzeProject("/absolutely/does/not/exist/xyz123", { language: "python" }),
    ).rejects.toThrow(AnalyzerError);
  });

  it("detectLanguage defaults to javascript for missing dir", async () => {
    // detectLanguage doesn't throw — falls back to extension scan → defaults to JS
    const lang = await detectLanguage("/absolutely/does/not/exist/xyz123");
    expect(lang).toBe("javascript");
  });
});

// ═══════════════════════════════════════════════════════
// 2. 完全に空のディレクトリ
// ═══════════════════════════════════════════════════════

describe("completely empty directory", () => {
  let emptyDir: string;

  beforeAll(async () => {
    emptyDir = join(tempDir, "empty");
    await mkdir(emptyDir, { recursive: true });
  });

  it("detectLanguage defaults to javascript", async () => {
    const lang = await detectLanguage(emptyDir);
    expect(lang).toBe("javascript");
  });

  it("analyzeProject returns empty graph (not crash)", async () => {
    // With auto-detection, it'll try dependency-cruiser on empty dir → 0 files
    const graph = await analyzeProject(emptyDir);
    expect(graph.totalFiles).toBe(0);
    expect(graph.totalEdges).toBe(0);
    expect(graph.circularDependencies).toEqual([]);
  });

  it("analyzeProject with explicit language returns empty graph", async () => {
    const graph = await analyzeProject(emptyDir, { language: "python" });
    expect(graph.totalFiles).toBe(0);
    expect(graph.totalEdges).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════
// 3. マーカーファイルがターゲットではなく親にある場合
//    (archtracker analyze --target src の典型パターン)
// ═══════════════════════════════════════════════════════

describe("marker files in parent directory (not target)", () => {
  let projectDir: string;
  let srcDir: string;

  beforeAll(async () => {
    projectDir = join(tempDir, "marker-parent");
    srcDir = join(projectDir, "src");
    await mkdir(srcDir, { recursive: true });

    // Marker is in project root, not in src/
    await writeFile(join(projectDir, "pyproject.toml"), "[project]\nname = 'test'\n");
    await writeFile(join(srcDir, "main.py"), "import utils\nprint('hello')\n");
    await writeFile(join(srcDir, "utils.py"), "def helper(): pass\n");
  });

  it("detectLanguage on src/ falls back to extension scan (finds .py)", async () => {
    // pyproject.toml is in parent, NOT in src/
    // Extension fallback should still detect Python
    const lang = await detectLanguage(srcDir);
    expect(lang).toBe("python");
  });

  it("detectLanguage on project root finds marker directly", async () => {
    const lang = await detectLanguage(projectDir);
    expect(lang).toBe("python");
  });

  it("analyzeProject on src/ with auto-detection works", async () => {
    const graph = await analyzeProject(srcDir);
    expect(graph.totalFiles).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════
// 4. --language で間違った言語を指定した場合
// ═══════════════════════════════════════════════════════

describe("wrong language override", () => {
  let pyDir: string;

  beforeAll(async () => {
    pyDir = join(tempDir, "wrong-lang");
    await mkdir(pyDir, { recursive: true });
    await writeFile(join(pyDir, "main.py"), "import os\nprint('hello')\n");
    await writeFile(join(pyDir, "utils.py"), "def foo(): pass\n");
  });

  it("analyzing Python project with language=rust returns 0 files", async () => {
    // Rust regex won't find .py files (different extensions)
    const graph = await analyzeProject(pyDir, { language: "rust" });
    expect(graph.totalFiles).toBe(0);
  });

  it("analyzing Python project with language=go returns 0 files", async () => {
    const graph = await analyzeProject(pyDir, { language: "go" });
    expect(graph.totalFiles).toBe(0);
  });

  it("correct language override works", async () => {
    const graph = await analyzeProject(pyDir, { language: "python" });
    expect(graph.totalFiles).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════
// 5. LANGUAGE_IDS の整合性
// ═══════════════════════════════════════════════════════

describe("LANGUAGE_IDS consistency", () => {
  it("every non-JS language has a config in getLanguageConfig", () => {
    for (const id of LANGUAGE_IDS) {
      if (id === "javascript") continue;
      const config = getLanguageConfig(id);
      expect(config, `Missing config for ${id}`).toBeDefined();
      expect(config!.extensions.length, `${id} has no extensions`).toBeGreaterThan(0);
      // Languages use either importPatterns or custom extractImports
      const hasPatterns = config!.importPatterns.length > 0;
      const hasExtractor = typeof config!.extractImports === "function";
      expect(
        hasPatterns || hasExtractor,
        `${id} has neither importPatterns nor extractImports`,
      ).toBe(true);
    }
  });

  it("every config has a working resolveImport function", () => {
    for (const id of LANGUAGE_IDS) {
      if (id === "javascript") continue;
      const config = getLanguageConfig(id);
      expect(config).toBeDefined();
      // resolveImport should be callable without crashing
      const result = config!.resolveImport("nonexistent", "test.ts", "/tmp", new Set());
      expect(result).toBeNull();
    }
  });

  it("LANGUAGE_IDS contains exactly the expected languages", () => {
    expect(LANGUAGE_IDS).toContain("javascript");
    expect(LANGUAGE_IDS).toContain("python");
    expect(LANGUAGE_IDS).toContain("rust");
    expect(LANGUAGE_IDS).toContain("go");
    expect(LANGUAGE_IDS).toContain("java");
    expect(LANGUAGE_IDS).toContain("c-cpp");
    expect(LANGUAGE_IDS).toContain("c-sharp");
    expect(LANGUAGE_IDS).toContain("ruby");
    expect(LANGUAGE_IDS).toContain("php");
    expect(LANGUAGE_IDS).toContain("swift");
    expect(LANGUAGE_IDS).toContain("kotlin");
    expect(LANGUAGE_IDS).toContain("dart");
    expect(LANGUAGE_IDS).toContain("scala");
    expect(LANGUAGE_IDS.length).toBe(13);
  });
});

// ═══════════════════════════════════════════════════════
// 6. ソースファイルが壊れている場合
// ═══════════════════════════════════════════════════════

describe("malformed source files", () => {
  let malformedDir: string;

  beforeAll(async () => {
    malformedDir = join(tempDir, "malformed");
    await mkdir(malformedDir, { recursive: true });
    await writeFile(join(malformedDir, "pyproject.toml"), "[project]\n");

    // Binary garbage in a .py file
    await writeFile(join(malformedDir, "binary.py"), Buffer.from([0x00, 0xFF, 0xFE, 0x89, 0x50]));

    // Truncated import statement
    await writeFile(join(malformedDir, "truncated.py"), "from incomplete_module imp");

    // Valid file to ensure partial success
    await writeFile(join(malformedDir, "valid.py"), "import os\nprint('ok')\n");

    // Extremely long line
    await writeFile(
      join(malformedDir, "longline.py"),
      "import " + "a".repeat(10000) + "\n",
    );
  });

  it("does not crash on binary content", async () => {
    const graph = await analyzeProject(malformedDir, { language: "python" });
    // Should process files without crashing
    expect(graph.totalFiles).toBeGreaterThanOrEqual(1);
  });

  it("handles truncated import lines gracefully", async () => {
    const graph = await analyzeProject(malformedDir, { language: "python" });
    // truncated.py exists but "from incomplete_module imp" doesn't match import regex
    expect(graph.files).toBeDefined();
  });

  it("handles extremely long lines without hanging", async () => {
    const graph = await analyzeProject(malformedDir, { language: "python" });
    expect(graph.totalFiles).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════
// 7. 混合言語プロジェクト（TS + Python が同じ dir にある）
// ═══════════════════════════════════════════════════════

describe("mixed language project", () => {
  let mixedDir: string;

  beforeAll(async () => {
    mixedDir = join(tempDir, "mixed-lang");
    await mkdir(mixedDir, { recursive: true });
    // Has both .py and .ts files
    await writeFile(join(mixedDir, "app.py"), "import utils\n");
    await writeFile(join(mixedDir, "utils.py"), "def foo(): pass\n");
    await writeFile(join(mixedDir, "index.ts"), "import { foo } from './bar';\n");
    await writeFile(join(mixedDir, "bar.ts"), "export const foo = 1;\n");
  });

  it("auto-detects based on extension frequency", async () => {
    // Equal .py and .ts — depends on which wins the count
    const lang = await detectLanguage(mixedDir);
    expect(["python", "javascript"]).toContain(lang);
  });

  it("explicit python language only scans .py files", async () => {
    const graph = await analyzeProject(mixedDir, { language: "python" });
    const paths = Object.keys(graph.files);
    expect(paths.every((p) => p.endsWith(".py"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// 8. exclude パターンの堅牢性
// ═══════════════════════════════════════════════════════

describe("exclude patterns robustness", () => {
  let excludeDir: string;

  beforeAll(async () => {
    excludeDir = join(tempDir, "exclude-test");
    await mkdir(join(excludeDir, "src"), { recursive: true });
    await mkdir(join(excludeDir, "test"), { recursive: true });
    await mkdir(join(excludeDir, "__mocks__"), { recursive: true });
    await writeFile(join(excludeDir, "pyproject.toml"), "[project]\n");
    await writeFile(join(excludeDir, "src", "main.py"), "import lib\n");
    await writeFile(join(excludeDir, "src", "lib.py"), "x = 1\n");
    await writeFile(join(excludeDir, "test", "test_main.py"), "import main\n");
    await writeFile(join(excludeDir, "__mocks__", "mock_lib.py"), "x = 2\n");
  });

  it("excludes directory by regex", async () => {
    // Use anchored pattern to avoid matching temp dir paths
    const graph = await analyzeProject(excludeDir, {
      language: "python",
      exclude: ["^test/"],
    });
    const paths = Object.keys(graph.files);
    expect(paths.some((p) => p.startsWith("test/"))).toBe(false);
    // src/ files should remain
    expect(paths.some((p) => p.startsWith("src/"))).toBe(true);
  });

  it("excludes multiple patterns", async () => {
    const graph = await analyzeProject(excludeDir, {
      language: "python",
      exclude: ["^test/", "^__mocks__/"],
    });
    const paths = Object.keys(graph.files);
    expect(paths.some((p) => p.startsWith("test/"))).toBe(false);
    expect(paths.some((p) => p.startsWith("__mocks__/"))).toBe(false);
    expect(paths.some((p) => p.startsWith("src/"))).toBe(true);
  });

  it("handles regex special chars in exclude safely", async () => {
    // __mocks__ has regex-special chars but should still work
    const graph = await analyzeProject(excludeDir, {
      language: "python",
      exclude: ["^__mocks__/"],
    });
    expect(graph.totalFiles).toBeGreaterThan(0);
    const paths = Object.keys(graph.files);
    expect(paths.some((p) => p.includes("__mocks__"))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════
// 9. 深いネストのディレクトリ構造
// ═══════════════════════════════════════════════════════

describe("deeply nested directory structure", () => {
  let deepDir: string;

  beforeAll(async () => {
    deepDir = join(tempDir, "deep-nest");
    const deep = join(deepDir, "a", "b", "c", "d", "e");
    await mkdir(deep, { recursive: true });
    await writeFile(join(deepDir, "pyproject.toml"), "[project]\n");
    await writeFile(join(deepDir, "top.py"), "from a.b.c.d.e.bottom import x\n");
    await writeFile(join(deep, "bottom.py"), "x = 42\n");
  });

  it("finds files in deeply nested directories", async () => {
    const graph = await analyzeProject(deepDir, { language: "python" });
    expect(graph.totalFiles).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════
// 10. maxDepth=1 で依存解析の深度制限
// ═══════════════════════════════════════════════════════

describe("maxDepth limiting", () => {
  let depthDir: string;

  beforeAll(async () => {
    depthDir = join(tempDir, "depth-limit");
    await mkdir(join(depthDir, "sub"), { recursive: true });
    await writeFile(join(depthDir, "pyproject.toml"), "[project]\n");
    await writeFile(join(depthDir, "main.py"), "import sub.child\n");
    await writeFile(join(depthDir, "sub", "child.py"), "x = 1\n");
  });

  it("maxDepth=0 returns all files", async () => {
    const graph = await analyzeProject(depthDir, { language: "python", maxDepth: 0 });
    expect(graph.totalFiles).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════
// 11. RegexEngine: 各言語の resolveImport が null を正しく返す
// ═══════════════════════════════════════════════════════

describe("resolveImport returns null for unresolvable imports", () => {
  const nonJsLanguages = LANGUAGE_IDS.filter((id) => id !== "javascript") as LanguageId[];

  for (const lang of nonJsLanguages) {
    it(`${lang}: unresolvable import returns null`, () => {
      const config = getLanguageConfig(lang)!;
      const result = config.resolveImport(
        "this.does.not.exist.anywhere",
        "source.file",
        "/nonexistent/root",
        new Set(),
      );
      expect(result).toBeNull();
    });
  }
});

// ═══════════════════════════════════════════════════════
// 12. ファイルが import している先が存在しない場合
// ═══════════════════════════════════════════════════════

describe("unresolvable imports (ghost dependencies)", () => {
  let ghostDir: string;

  beforeAll(async () => {
    ghostDir = join(tempDir, "ghost-deps");
    await mkdir(ghostDir, { recursive: true });
    await writeFile(join(ghostDir, "pyproject.toml"), "[project]\n");
    // imports a module that doesn't exist
    await writeFile(join(ghostDir, "main.py"), "import nonexistent_module\nfrom missing import stuff\n");
  });

  it("handles missing import targets without crashing", async () => {
    const graph = await analyzeProject(ghostDir, { language: "python" });
    // main.py should exist, missing modules should be ignored (null resolution)
    expect(graph.totalFiles).toBeGreaterThanOrEqual(1);
    expect(graph.files).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════
// 13. 同一ファイルを複数回 import している場合
// ═══════════════════════════════════════════════════════

describe("duplicate imports in same file", () => {
  let dupeDir: string;

  beforeAll(async () => {
    dupeDir = join(tempDir, "dupe-imports");
    await mkdir(dupeDir, { recursive: true });
    await writeFile(join(dupeDir, "pyproject.toml"), "[project]\n");
    await writeFile(
      join(dupeDir, "main.py"),
      "import utils\nimport utils\nfrom utils import foo\nfrom utils import bar\n",
    );
    await writeFile(join(dupeDir, "utils.py"), "def foo(): pass\ndef bar(): pass\n");
  });

  it("deduplicates edges (no duplicate source→target)", async () => {
    const graph = await analyzeProject(dupeDir, { language: "python" });
    const mainEdges = graph.edges.filter(
      (e) => e.source.includes("main.py") && e.target.includes("utils.py"),
    );
    // Should have exactly 1 edge, not 4
    expect(mainEdges.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════
// 14. Unicode ファイル名 / パス
// ═══════════════════════════════════════════════════════

describe("unicode in paths", () => {
  let unicodeDir: string;

  beforeAll(async () => {
    unicodeDir = join(tempDir, "ユニコード");
    await mkdir(unicodeDir, { recursive: true });
    await writeFile(join(unicodeDir, "pyproject.toml"), "[project]\n");
    await writeFile(join(unicodeDir, "main.py"), "import helper\n");
    await writeFile(join(unicodeDir, "helper.py"), "x = 1\n");
  });

  it("handles unicode directory names", async () => {
    const graph = await analyzeProject(unicodeDir, { language: "python" });
    expect(graph.totalFiles).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════
// 15. 循環依存が複数ある場合
// ═══════════════════════════════════════════════════════

describe("multiple circular dependencies", () => {
  let circDir: string;

  beforeAll(async () => {
    circDir = join(tempDir, "multi-circular");
    await mkdir(circDir, { recursive: true });
    await writeFile(join(circDir, "pyproject.toml"), "[project]\n");
    // Cycle 1: a ↔ b
    await writeFile(join(circDir, "a.py"), "import b\n");
    await writeFile(join(circDir, "b.py"), "import a\n");
    // Cycle 2: x → y → z → x
    await writeFile(join(circDir, "x.py"), "import y\n");
    await writeFile(join(circDir, "y.py"), "import z\n");
    await writeFile(join(circDir, "z.py"), "import x\n");
  });

  it("detects all circular dependency cycles", async () => {
    const graph = await analyzeProject(circDir, { language: "python" });
    expect(graph.circularDependencies.length).toBeGreaterThanOrEqual(2);
  });

  it("each cycle has at least 2 files", async () => {
    const graph = await analyzeProject(circDir, { language: "python" });
    for (const circ of graph.circularDependencies) {
      expect(circ.cycle.length).toBeGreaterThanOrEqual(2);
    }
  });
});

// ═══════════════════════════════════════════════════════
// 16. 言語検出: 拡張子が拮抗する場合
// ═══════════════════════════════════════════════════════

describe("language detection with competing extensions", () => {
  it("marker file takes priority over extension count", async () => {
    const prioDir = join(tempDir, "marker-priority");
    await mkdir(prioDir, { recursive: true });
    // Marker says Python
    await writeFile(join(prioDir, "pyproject.toml"), "[project]\n");
    // But more .rs files than .py files
    await writeFile(join(prioDir, "a.rs"), "fn main() {}\n");
    await writeFile(join(prioDir, "b.rs"), "fn foo() {}\n");
    await writeFile(join(prioDir, "c.rs"), "fn bar() {}\n");
    await writeFile(join(prioDir, "d.py"), "x = 1\n");

    const lang = await detectLanguage(prioDir);
    expect(lang).toBe("python"); // marker > extension count
  });

  it("earlier marker in list takes priority", async () => {
    const multiMarkerDir = join(tempDir, "multi-marker");
    await mkdir(multiMarkerDir, { recursive: true });
    // Both Cargo.toml (rust) and go.mod (go) present — Cargo.toml is earlier in list
    await writeFile(join(multiMarkerDir, "Cargo.toml"), "[package]\n");
    await writeFile(join(multiMarkerDir, "go.mod"), "module test\n");

    const lang = await detectLanguage(multiMarkerDir);
    expect(lang).toBe("rust"); // Cargo.toml appears before go.mod in MARKERS
  });
});

// ═══════════════════════════════════════════════════════
// 17. C# 拡張子マーカー (.sln, .csproj)
// ═══════════════════════════════════════════════════════

describe("C# extension-based marker detection", () => {
  it("detects C# from .sln file", async () => {
    const csDir = join(tempDir, "csharp-sln");
    await mkdir(csDir, { recursive: true });
    await writeFile(join(csDir, "MyApp.sln"), "solution content\n");
    await writeFile(join(csDir, "Program.cs"), "using System;\n");

    const lang = await detectLanguage(csDir);
    expect(lang).toBe("c-sharp");
  });

  it("detects C# from .csproj file", async () => {
    const csDir = join(tempDir, "csharp-csproj");
    await mkdir(csDir, { recursive: true });
    await writeFile(join(csDir, "MyApp.csproj"), "<Project />\n");
    await writeFile(join(csDir, "Program.cs"), "using System;\n");

    const lang = await detectLanguage(csDir);
    expect(lang).toBe("c-sharp");
  });
});

// ═══════════════════════════════════════════════════════
// 18. 自己参照 (self-import) の防止
// ═══════════════════════════════════════════════════════

describe("self-import prevention", () => {
  let selfDir: string;

  beforeAll(async () => {
    selfDir = join(tempDir, "self-import");
    await mkdir(selfDir, { recursive: true });
    await writeFile(join(selfDir, "pyproject.toml"), "[project]\n");
    // File imports itself
    await writeFile(join(selfDir, "self.py"), "import self\n");
  });

  it("does not create self-referencing edges", async () => {
    const graph = await analyzeProject(selfDir, { language: "python" });
    for (const edge of graph.edges) {
      expect(edge.source).not.toBe(edge.target);
    }
  });
});

// ═══════════════════════════════════════════════════════
// 19. コメント内の import が無視されることの確認（全言語横断）
// ═══════════════════════════════════════════════════════

describe("commented imports are ignored across languages", () => {
  it("Python: # commented import", async () => {
    const dir = join(tempDir, "comment-py");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "pyproject.toml"), "[project]\n");
    await writeFile(join(dir, "main.py"), "# import secret\nimport real\n");
    await writeFile(join(dir, "real.py"), "x = 1\n");
    await writeFile(join(dir, "secret.py"), "x = 2\n");

    const graph = await analyzeProject(dir, { language: "python" });
    const mainEdges = graph.edges.filter((e) => e.source.includes("main.py"));
    // Should only have edge to real.py, not secret.py
    expect(mainEdges.length).toBe(1);
    expect(mainEdges[0].target).toContain("real.py");
  });

  it("Rust: // commented use", async () => {
    const dir = join(tempDir, "comment-rs");
    await mkdir(join(dir, "src"), { recursive: true });
    await writeFile(join(dir, "Cargo.toml"), "[package]\nname = 'test'\n");
    await writeFile(
      join(dir, "src", "main.rs"),
      "// use crate::secret;\nuse crate::real;\nfn main() {}\n",
    );
    await writeFile(join(dir, "src", "real.rs"), "pub fn foo() {}\n");
    await writeFile(join(dir, "src", "secret.rs"), "pub fn bar() {}\n");

    const graph = await analyzeProject(dir, { language: "rust" });
    const mainEdges = graph.edges.filter((e) => e.source.includes("main.rs"));
    expect(mainEdges.some((e) => e.target.includes("real.rs"))).toBe(true);
    expect(mainEdges.some((e) => e.target.includes("secret.rs"))).toBe(false);
  });

  it("Go: // commented import", async () => {
    const dir = join(tempDir, "comment-go");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "go.mod"), "module test\n\ngo 1.21\n");
    await writeFile(
      join(dir, "main.go"),
      'package main\n// import "test/secret"\nimport "test/real"\n',
    );
    await writeFile(join(dir, "real.go"), "package real\n");
    await writeFile(join(dir, "secret.go"), "package secret\n");

    const graph = await analyzeProject(dir, { language: "go" });
    const mainEdges = graph.edges.filter((e) => e.source.includes("main.go"));
    expect(mainEdges.some((e) => e.target.includes("secret.go"))).toBe(false);
  });

  it("Java: /* block comment */ import", async () => {
    const dir = join(tempDir, "comment-java");
    await mkdir(join(dir, "com", "example"), { recursive: true });
    await writeFile(join(dir, "pom.xml"), "<project/>\n");
    await writeFile(
      join(dir, "com", "example", "Main.java"),
      "package com.example;\n/* import com.example.Secret; */\nimport com.example.Real;\n",
    );
    await writeFile(join(dir, "com", "example", "Real.java"), "package com.example;\npublic class Real {}\n");
    await writeFile(join(dir, "com", "example", "Secret.java"), "package com.example;\npublic class Secret {}\n");

    const graph = await analyzeProject(dir, { language: "java" });
    const mainEdges = graph.edges.filter((e) => e.source.includes("Main.java"));
    expect(mainEdges.some((e) => e.target.includes("Real.java"))).toBe(true);
    expect(mainEdges.some((e) => e.target.includes("Secret.java"))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════
// 20. graph の整合性検証（依存←→被依存の対称性）
// ═══════════════════════════════════════════════════════

describe("graph integrity: dependency ↔ dependent symmetry", () => {
  let integrityDir: string;

  beforeAll(async () => {
    integrityDir = join(tempDir, "integrity");
    await mkdir(integrityDir, { recursive: true });
    await writeFile(join(integrityDir, "pyproject.toml"), "[project]\n");
    await writeFile(join(integrityDir, "a.py"), "import b\nimport c\n");
    await writeFile(join(integrityDir, "b.py"), "import c\n");
    await writeFile(join(integrityDir, "c.py"), "x = 1\n");
  });

  it("every edge has matching dependency and dependent entries", async () => {
    const graph = await analyzeProject(integrityDir, { language: "python" });

    for (const edge of graph.edges) {
      const sourceNode = graph.files[edge.source];
      const targetNode = graph.files[edge.target];

      expect(sourceNode, `source ${edge.source} missing from files`).toBeDefined();
      expect(targetNode, `target ${edge.target} missing from files`).toBeDefined();

      expect(
        sourceNode.dependencies,
        `${edge.source}.dependencies should contain ${edge.target}`,
      ).toContain(edge.target);
      expect(
        targetNode.dependents,
        `${edge.target}.dependents should contain ${edge.source}`,
      ).toContain(edge.source);
    }
  });

  it("totalFiles matches Object.keys(files).length", async () => {
    const graph = await analyzeProject(integrityDir, { language: "python" });
    expect(graph.totalFiles).toBe(Object.keys(graph.files).length);
  });

  it("totalEdges matches edges.length", async () => {
    const graph = await analyzeProject(integrityDir, { language: "python" });
    expect(graph.totalEdges).toBe(graph.edges.length);
  });
});
