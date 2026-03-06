import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { analyzeProject } from "../analyze.js";
import { detectLanguage } from "./detect.js";
import { detectCycles } from "./cycle.js";
import { stripComments } from "./strip-comments.js";
import type { DependencyEdge, DependencyGraph } from "../../types/schema.js";

const FIXTURES = join(import.meta.dirname, "..", "__fixtures__");

/** Helper: check that an edge source→target exists */
function hasEdge(graph: DependencyGraph, source: string, target: string): boolean {
  return graph.edges.some((e) => e.source === source && e.target === target);
}

/** Helper: get all edges from a source */
function edgesFrom(graph: DependencyGraph, source: string): DependencyEdge[] {
  return graph.edges.filter((e) => e.source === source);
}

/** Helper: check that NO edge from source to target exists */
function hasNoEdge(graph: DependencyGraph, source: string, target: string): boolean {
  return !graph.edges.some((e) => e.source === source && e.target === target);
}

// ═══════════════════════════════════════════════════════
// Language Detection
// ═══════════════════════════════════════════════════════

describe("detectLanguage", () => {
  it("should detect Python from pyproject.toml", async () => {
    expect(await detectLanguage(join(FIXTURES, "python-project"))).toBe("python");
  });

  it("should detect Rust from Cargo.toml", async () => {
    expect(await detectLanguage(join(FIXTURES, "rust-project"))).toBe("rust");
  });

  it("should detect Go from go.mod", async () => {
    expect(await detectLanguage(join(FIXTURES, "go-project"))).toBe("go");
  });

  it("should detect Java from pom.xml", async () => {
    expect(await detectLanguage(join(FIXTURES, "java-project"))).toBe("java");
  });

  it("should detect Ruby from Gemfile", async () => {
    expect(await detectLanguage(join(FIXTURES, "ruby-project"))).toBe("ruby");
  });

  it("should detect PHP from composer.json", async () => {
    expect(await detectLanguage(join(FIXTURES, "php-project"))).toBe("php");
  });

  it("should detect Swift from Package.swift", async () => {
    expect(await detectLanguage(join(FIXTURES, "swift-project"))).toBe("swift");
  });

  it("should detect Kotlin from build.gradle.kts", async () => {
    expect(await detectLanguage(join(FIXTURES, "kotlin-project"))).toBe("kotlin");
  });

  it("should detect JS/TS from package.json", async () => {
    expect(await detectLanguage(join(FIXTURES, "sample-project"))).toBe("javascript");
  });
});

// ═══════════════════════════════════════════════════════
// Comment Stripping
// ═══════════════════════════════════════════════════════

describe("stripComments", () => {
  it("should strip C-style line comments", () => {
    const input = 'use crate::real;\n// use crate::fake;\nuse crate::also_real;';
    const result = stripComments(input, "c-style");
    expect(result).toContain("use crate::real;");
    expect(result).toContain("use crate::also_real;");
    expect(result).not.toContain("fake");
  });

  it("should strip C-style block comments", () => {
    const input = 'import real;\n/* import fake; */\nimport also_real;';
    const result = stripComments(input, "c-style");
    expect(result).toContain("import real;");
    expect(result).toContain("import also_real;");
    expect(result).not.toContain("fake");
  });

  it("should strip Python hash comments", () => {
    const input = 'import real\n# import fake\nimport also_real';
    const result = stripComments(input, "python");
    expect(result).toContain("import real");
    expect(result).toContain("import also_real");
    expect(result).not.toContain("fake");
  });

  it("should strip Python triple-quoted strings", () => {
    const input = '"""\nimport fake_in_docstring\n"""\nimport real';
    const result = stripComments(input, "python");
    expect(result).toContain("import real");
    expect(result).not.toContain("fake_in_docstring");
  });

  it("should strip Ruby hash comments and =begin/=end blocks", () => {
    const input = "require 'real'\n# require 'fake'\n=begin\nrequire 'block_fake'\n=end\nrequire 'also_real'";
    const result = stripComments(input, "ruby");
    expect(result).toContain("require 'real'");
    expect(result).toContain("require 'also_real'");
    expect(result).not.toContain("fake");
    expect(result).not.toContain("block_fake");
  });

  it("should strip PHP comments (// and # and /* */)", () => {
    const input = "require 'real.php';\n// require 'fake1.php';\n# require 'fake2.php';\n/* require 'fake3.php'; */\nrequire 'also_real.php';";
    const result = stripComments(input, "php");
    expect(result).toContain("require 'real.php'");
    expect(result).toContain("require 'also_real.php'");
    expect(result).not.toContain("fake1");
    expect(result).not.toContain("fake2");
    expect(result).not.toContain("fake3");
  });

  it("should preserve strings in C-style", () => {
    const input = 'import "real/path";\nconst x = "// not a comment";';
    const result = stripComments(input, "c-style");
    expect(result).toContain('"real/path"');
    expect(result).toContain('"// not a comment"');
  });

  it("should preserve newlines for line-number accuracy", () => {
    const input = 'line1\n/* block\ncomment */\nline4';
    const result = stripComments(input, "c-style");
    const lines = result.split("\n");
    expect(lines.length).toBe(4);
    expect(lines[0]).toBe("line1");
    expect(lines[3]).toBe("line4");
  });
});

// ═══════════════════════════════════════════════════════
// Cycle Detection
// ═══════════════════════════════════════════════════════

describe("detectCycles", () => {
  it("should detect a simple A↔B cycle", () => {
    const edges: DependencyEdge[] = [
      { source: "a.py", target: "b.py", type: "static" },
      { source: "b.py", target: "a.py", type: "static" },
    ];
    const cycles = detectCycles(edges);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].cycle).toContain("a.py");
    expect(cycles[0].cycle).toContain("b.py");
  });

  it("should detect a 3-node cycle A→B→C→A", () => {
    const edges: DependencyEdge[] = [
      { source: "a", target: "b", type: "static" },
      { source: "b", target: "c", type: "static" },
      { source: "c", target: "a", type: "static" },
    ];
    const cycles = detectCycles(edges);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].cycle).toContain("a");
    expect(cycles[0].cycle).toContain("b");
    expect(cycles[0].cycle).toContain("c");
  });

  it("should return empty for acyclic graph", () => {
    const edges: DependencyEdge[] = [
      { source: "a", target: "b", type: "static" },
      { source: "b", target: "c", type: "static" },
    ];
    expect(detectCycles(edges)).toHaveLength(0);
  });

  it("should deduplicate the same cycle found from different entry points", () => {
    const edges: DependencyEdge[] = [
      { source: "a", target: "b", type: "static" },
      { source: "b", target: "c", type: "static" },
      { source: "c", target: "a", type: "static" },
    ];
    const cycles = detectCycles(edges);
    expect(cycles).toHaveLength(1);
  });

  it("should detect multiple independent cycles", () => {
    const edges: DependencyEdge[] = [
      { source: "a", target: "b", type: "static" },
      { source: "b", target: "a", type: "static" },
      { source: "x", target: "y", type: "static" },
      { source: "y", target: "x", type: "static" },
    ];
    const cycles = detectCycles(edges);
    expect(cycles).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════
// Python Analysis
// ═══════════════════════════════════════════════════════

describe("Python analyzer", () => {
  const dir = join(FIXTURES, "python-project");

  it("should find all Python files", async () => {
    const graph = await analyzeProject(dir, { language: "python" });
    const files = Object.keys(graph.files).sort();
    expect(files).toContain("main.py");
    expect(files).toContain("utils.py");
    expect(files).toContain("models/user.py");
    expect(files).toContain("models/__init__.py");
    expect(files).toContain("circular_a.py");
    expect(files).toContain("circular_b.py");
    expect(files).toContain("services/__init__.py");
    expect(files).toContain("services/api.py");
  });

  it("should resolve main.py → utils.py edge", async () => {
    const graph = await analyzeProject(dir, { language: "python" });
    expect(hasEdge(graph, "main.py", "utils.py")).toBe(true);
  });

  it("should resolve main.py → models/__init__.py edge (import models.user)", async () => {
    const graph = await analyzeProject(dir, { language: "python" });
    // `import models.user` resolves to models/__init__.py or models/user.py
    const mainEdges = edgesFrom(graph, "main.py");
    const targetsModels = mainEdges.some(
      (e) => e.target.startsWith("models/"),
    );
    expect(targetsModels).toBe(true);
  });

  it("should resolve utils.py → models/user.py edge", async () => {
    const graph = await analyzeProject(dir, { language: "python" });
    expect(hasEdge(graph, "utils.py", "models/user.py")).toBe(true);
  });

  it("should resolve relative import (..models.user) in services/api.py", async () => {
    const graph = await analyzeProject(dir, { language: "python" });
    expect(hasEdge(graph, "services/api.py", "models/user.py")).toBe(true);
  });

  it("should NOT create edges from commented-out imports", async () => {
    const graph = await analyzeProject(dir, { language: "python" });
    // main.py has `# from fake_module import should_not_resolve` and triple-quoted fake imports
    const mainEdges = edgesFrom(graph, "main.py");
    for (const edge of mainEdges) {
      expect(edge.target).not.toContain("fake");
      expect(edge.target).not.toContain("docstring");
    }
  });

  it("should detect circular dependency between circular_a.py and circular_b.py", async () => {
    const graph = await analyzeProject(dir, { language: "python" });
    expect(graph.circularDependencies.length).toBeGreaterThanOrEqual(1);
    const allCycleFiles = graph.circularDependencies.flatMap((c) => c.cycle);
    expect(allCycleFiles).toContain("circular_a.py");
    expect(allCycleFiles).toContain("circular_b.py");
  });

  it("should have no duplicate edges", async () => {
    const graph = await analyzeProject(dir, { language: "python" });
    const edgeKeys = graph.edges.map((e) => `${e.source}\0${e.target}`);
    expect(new Set(edgeKeys).size).toBe(edgeKeys.length);
  });
});

// ═══════════════════════════════════════════════════════
// Rust Analysis
// ═══════════════════════════════════════════════════════

describe("Rust analyzer", () => {
  const dir = join(FIXTURES, "rust-project");

  it("should find all Rust files", async () => {
    const graph = await analyzeProject(dir, { language: "rust" });
    const files = Object.keys(graph.files).sort();
    expect(files).toContain("src/main.rs");
    expect(files).toContain("src/utils.rs");
    expect(files).toContain("src/models.rs");
    expect(graph.totalFiles).toBe(3);
  });

  it("should resolve mod utils; → src/utils.rs", async () => {
    const graph = await analyzeProject(dir, { language: "rust" });
    expect(hasEdge(graph, "src/main.rs", "src/utils.rs")).toBe(true);
  });

  it("should resolve mod models; → src/models.rs", async () => {
    const graph = await analyzeProject(dir, { language: "rust" });
    expect(hasEdge(graph, "src/main.rs", "src/models.rs")).toBe(true);
  });

  it("should resolve grouped use crate::models::{User, Config} → src/models.rs", async () => {
    const graph = await analyzeProject(dir, { language: "rust" });
    // The grouped use should resolve both User and Config to models.rs
    // But since they're the same target, edge should be deduplicated
    expect(hasEdge(graph, "src/main.rs", "src/models.rs")).toBe(true);
  });

  it("should NOT create edges from commented-out use statements", async () => {
    const graph = await analyzeProject(dir, { language: "rust" });
    const mainEdges = edgesFrom(graph, "src/main.rs");
    for (const edge of mainEdges) {
      expect(edge.target).not.toContain("fake");
    }
  });

  it("should deduplicate edges (mod + use to same file)", async () => {
    const graph = await analyzeProject(dir, { language: "rust" });
    const edgeKeys = graph.edges.map((e) => `${e.source}\0${e.target}`);
    expect(new Set(edgeKeys).size).toBe(edgeKeys.length);
  });
});

// ═══════════════════════════════════════════════════════
// Go Analysis
// ═══════════════════════════════════════════════════════

describe("Go analyzer", () => {
  const dir = join(FIXTURES, "go-project");

  it("should find all Go files", async () => {
    const graph = await analyzeProject(dir, { language: "go" });
    const files = Object.keys(graph.files).sort();
    expect(files).toContain("main.go");
    expect(files).toContain("handler.go");
    expect(files).toContain("pkg/utils/utils.go");
    expect(graph.totalFiles).toBe(3);
  });

  it("should resolve main.go → pkg/utils/utils.go from import block", async () => {
    const graph = await analyzeProject(dir, { language: "go" });
    expect(hasEdge(graph, "main.go", "pkg/utils/utils.go")).toBe(true);
  });

  it("should resolve handler.go → pkg/utils/utils.go from single import", async () => {
    const graph = await analyzeProject(dir, { language: "go" });
    expect(hasEdge(graph, "handler.go", "pkg/utils/utils.go")).toBe(true);
  });

  it("should NOT resolve external imports (fmt)", async () => {
    const graph = await analyzeProject(dir, { language: "go" });
    const mainEdges = edgesFrom(graph, "main.go");
    // Only internal import to pkg/utils
    expect(mainEdges).toHaveLength(1);
    expect(mainEdges[0].target).toBe("pkg/utils/utils.go");
  });

  it("should NOT create edges from commented-out imports", async () => {
    const graph = await analyzeProject(dir, { language: "go" });
    const mainEdges = edgesFrom(graph, "main.go");
    for (const edge of mainEdges) {
      expect(edge.target).not.toContain("fake");
    }
  });
});

// ═══════════════════════════════════════════════════════
// Java Analysis
// ═══════════════════════════════════════════════════════

describe("Java analyzer", () => {
  const dir = join(FIXTURES, "java-project");

  it("should find all Java files", async () => {
    const graph = await analyzeProject(dir, { language: "java" });
    const files = Object.keys(graph.files).sort();
    expect(files).toContain("src/main/java/com/example/Main.java");
    expect(files).toContain("src/main/java/com/example/Service.java");
    expect(files).toContain("src/main/java/com/example/Repository.java");
    expect(graph.totalFiles).toBe(3);
  });

  it("should resolve Main.java → Service.java", async () => {
    const graph = await analyzeProject(dir, { language: "java" });
    expect(
      hasEdge(graph, "src/main/java/com/example/Main.java", "src/main/java/com/example/Service.java"),
    ).toBe(true);
  });

  it("should resolve Main.java → Repository.java", async () => {
    const graph = await analyzeProject(dir, { language: "java" });
    expect(
      hasEdge(graph, "src/main/java/com/example/Main.java", "src/main/java/com/example/Repository.java"),
    ).toBe(true);
  });

  it("should NOT create edges from commented-out imports", async () => {
    const graph = await analyzeProject(dir, { language: "java" });
    const mainEdges = edgesFrom(graph, "src/main/java/com/example/Main.java");
    expect(mainEdges).toHaveLength(2); // only Service and Repository
    for (const edge of mainEdges) {
      expect(edge.target).not.toContain("Fake");
    }
  });
});

// ═══════════════════════════════════════════════════════
// C/C++ Analysis
// ═══════════════════════════════════════════════════════

describe("C/C++ analyzer", () => {
  const dir = join(FIXTURES, "cpp-project");

  it("should find all C/C++ files", async () => {
    const graph = await analyzeProject(dir, { language: "c-cpp" });
    const files = Object.keys(graph.files).sort();
    expect(files).toContain("src/main.cpp");
    expect(files).toContain("src/utils.h");
    expect(files).toContain("src/utils.cpp");
    expect(files).toContain("include/config.h");
    expect(graph.totalFiles).toBe(4);
  });

  it("should resolve main.cpp → src/utils.h", async () => {
    const graph = await analyzeProject(dir, { language: "c-cpp" });
    expect(hasEdge(graph, "src/main.cpp", "src/utils.h")).toBe(true);
  });

  it("should resolve main.cpp → include/config.h", async () => {
    const graph = await analyzeProject(dir, { language: "c-cpp" });
    expect(hasEdge(graph, "src/main.cpp", "include/config.h")).toBe(true);
  });

  it("should resolve utils.cpp → src/utils.h", async () => {
    const graph = await analyzeProject(dir, { language: "c-cpp" });
    expect(hasEdge(graph, "src/utils.cpp", "src/utils.h")).toBe(true);
  });

  it("should NOT create edges from commented-out #includes", async () => {
    const graph = await analyzeProject(dir, { language: "c-cpp" });
    const mainEdges = edgesFrom(graph, "src/main.cpp");
    expect(mainEdges).toHaveLength(2); // utils.h and config.h only
    for (const edge of mainEdges) {
      expect(edge.target).not.toContain("fake");
    }
  });
});

// ═══════════════════════════════════════════════════════
// Ruby Analysis
// ═══════════════════════════════════════════════════════

describe("Ruby analyzer", () => {
  const dir = join(FIXTURES, "ruby-project");

  it("should find all Ruby files", async () => {
    const graph = await analyzeProject(dir, { language: "ruby" });
    const files = Object.keys(graph.files).sort();
    expect(files).toContain("app.rb");
    expect(files).toContain("lib/helper.rb");
    expect(files).toContain("lib/config.rb");
    expect(graph.totalFiles).toBe(3);
  });

  it("should resolve app.rb → lib/helper.rb", async () => {
    const graph = await analyzeProject(dir, { language: "ruby" });
    expect(hasEdge(graph, "app.rb", "lib/helper.rb")).toBe(true);
  });

  it("should resolve app.rb → lib/config.rb", async () => {
    const graph = await analyzeProject(dir, { language: "ruby" });
    expect(hasEdge(graph, "app.rb", "lib/config.rb")).toBe(true);
  });

  it("should NOT create edges from commented-out requires", async () => {
    const graph = await analyzeProject(dir, { language: "ruby" });
    const appEdges = edgesFrom(graph, "app.rb");
    expect(appEdges).toHaveLength(2); // helper and config only
    for (const edge of appEdges) {
      expect(edge.target).not.toContain("fake");
    }
  });
});

// ═══════════════════════════════════════════════════════
// PHP Analysis
// ═══════════════════════════════════════════════════════

describe("PHP analyzer", () => {
  const dir = join(FIXTURES, "php-project");

  it("should find all PHP files", async () => {
    const graph = await analyzeProject(dir, { language: "php" });
    const files = Object.keys(graph.files).sort();
    expect(files).toContain("index.php");
    expect(files).toContain("src/Controllers/HomeController.php");
    expect(files).toContain("src/Controllers/ApiController.php");
    expect(graph.totalFiles).toBe(3);
  });

  it("should resolve index.php → HomeController.php", async () => {
    const graph = await analyzeProject(dir, { language: "php" });
    expect(
      hasEdge(graph, "index.php", "src/Controllers/HomeController.php"),
    ).toBe(true);
  });

  it("should resolve index.php → ApiController.php", async () => {
    const graph = await analyzeProject(dir, { language: "php" });
    expect(
      hasEdge(graph, "index.php", "src/Controllers/ApiController.php"),
    ).toBe(true);
  });

  it("should NOT create edges from commented-out requires", async () => {
    const graph = await analyzeProject(dir, { language: "php" });
    const indexEdges = edgesFrom(graph, "index.php");
    expect(indexEdges).toHaveLength(2); // Home and Api only
    for (const edge of indexEdges) {
      expect(edge.target).not.toContain("Fake");
    }
  });
});

// ═══════════════════════════════════════════════════════
// Swift Analysis
// ═══════════════════════════════════════════════════════

describe("Swift analyzer", () => {
  const dir = join(FIXTURES, "swift-project");

  it("should find all Swift files", async () => {
    const graph = await analyzeProject(dir, { language: "swift" });
    const files = Object.keys(graph.files).sort();
    expect(files).toContain("Package.swift");
    expect(files).toContain("Sources/App/main.swift");
    expect(files).toContain("Sources/Utils/greet.swift");
    expect(graph.totalFiles).toBe(3);
  });

  it("should resolve import Utils → Sources/Utils/greet.swift", async () => {
    const graph = await analyzeProject(dir, { language: "swift" });
    expect(
      hasEdge(graph, "Sources/App/main.swift", "Sources/Utils/greet.swift"),
    ).toBe(true);
  });

  it("should NOT resolve import Foundation (external)", async () => {
    const graph = await analyzeProject(dir, { language: "swift" });
    const edges = edgesFrom(graph, "Sources/App/main.swift");
    for (const edge of edges) {
      expect(edge.target).not.toContain("Foundation");
    }
  });
});

// ═══════════════════════════════════════════════════════
// Kotlin Analysis
// ═══════════════════════════════════════════════════════

describe("Kotlin analyzer", () => {
  const dir = join(FIXTURES, "kotlin-project");

  it("should find all Kotlin files", async () => {
    const graph = await analyzeProject(dir, { language: "kotlin" });
    const files = Object.keys(graph.files).sort();
    expect(files).toContain("src/main/kotlin/com/example/Main.kt");
    expect(files).toContain("src/main/kotlin/com/example/Service.kt");
    expect(files).toContain("src/main/kotlin/com/example/Repository.kt");
    expect(graph.totalFiles).toBe(3);
  });

  it("should resolve Main.kt → Service.kt", async () => {
    const graph = await analyzeProject(dir, { language: "kotlin" });
    expect(
      hasEdge(graph, "src/main/kotlin/com/example/Main.kt", "src/main/kotlin/com/example/Service.kt"),
    ).toBe(true);
  });

  it("should resolve Main.kt → Repository.kt", async () => {
    const graph = await analyzeProject(dir, { language: "kotlin" });
    expect(
      hasEdge(graph, "src/main/kotlin/com/example/Main.kt", "src/main/kotlin/com/example/Repository.kt"),
    ).toBe(true);
  });

  it("should NOT create edges from commented-out imports", async () => {
    const graph = await analyzeProject(dir, { language: "kotlin" });
    const mainEdges = edgesFrom(graph, "src/main/kotlin/com/example/Main.kt");
    expect(mainEdges).toHaveLength(2); // Service and Repository only
    for (const edge of mainEdges) {
      expect(edge.target).not.toContain("Fake");
    }
  });
});

// ═══════════════════════════════════════════════════════
// Edge Deduplication
// ═══════════════════════════════════════════════════════

describe("Edge deduplication", () => {
  it("should not produce duplicate edges for Rust mod + use to same file", async () => {
    const dir = join(FIXTURES, "rust-project");
    const graph = await analyzeProject(dir, { language: "rust" });
    const edgeKeys = graph.edges.map((e) => `${e.source}→${e.target}`);
    expect(new Set(edgeKeys).size).toBe(edgeKeys.length);
  });

  it("should verify dependencies/dependents arrays match edges", async () => {
    const dir = join(FIXTURES, "python-project");
    const graph = await analyzeProject(dir, { language: "python" });

    for (const edge of graph.edges) {
      expect(graph.files[edge.source]?.dependencies).toContain(edge.target);
      expect(graph.files[edge.target]?.dependents).toContain(edge.source);
    }
  });
});

// ═══════════════════════════════════════════════════════
// Backward Compatibility (JS/TS)
// ═══════════════════════════════════════════════════════

describe("JS/TS backward compatibility", () => {
  const dir = join(FIXTURES, "sample-project");

  it("should still use dependency-cruiser for JS/TS", async () => {
    const graph = await analyzeProject(dir, {
      exclude: ["circular"],
      language: "javascript",
    });
    expect(graph.totalFiles).toBeGreaterThanOrEqual(3);
    expect(graph.totalEdges).toBeGreaterThanOrEqual(2);
  });

  it("should auto-detect JS/TS and produce same results", async () => {
    const explicit = await analyzeProject(dir, { exclude: ["circular"], language: "javascript" });
    const auto = await analyzeProject(dir, { exclude: ["circular"] });
    expect(auto.totalFiles).toBe(explicit.totalFiles);
    expect(auto.totalEdges).toBe(explicit.totalEdges);
  });

  it("should have proper edge types for JS/TS", async () => {
    const graph = await analyzeProject(dir, { exclude: ["circular"], language: "javascript" });
    for (const edge of graph.edges) {
      expect(["static", "dynamic", "type-only"]).toContain(edge.type);
    }
  });
});

// ═══════════════════════════════════════════════════════
// Graph Integrity
// ═══════════════════════════════════════════════════════

describe("Graph integrity", () => {
  const languages = [
    { name: "python", dir: "python-project" },
    { name: "rust", dir: "rust-project" },
    { name: "go", dir: "go-project" },
    { name: "java", dir: "java-project" },
    { name: "c-cpp", dir: "cpp-project" },
    { name: "ruby", dir: "ruby-project" },
    { name: "php", dir: "php-project" },
    { name: "swift", dir: "swift-project" },
    { name: "kotlin", dir: "kotlin-project" },
  ] as const;

  for (const { name, dir } of languages) {
    it(`${name}: all edge sources and targets should exist in files`, async () => {
      const graph = await analyzeProject(join(FIXTURES, dir), { language: name });
      for (const edge of graph.edges) {
        expect(graph.files[edge.source]).toBeDefined();
        expect(graph.files[edge.target]).toBeDefined();
      }
    });

    it(`${name}: totalFiles should match Object.keys(files).length`, async () => {
      const graph = await analyzeProject(join(FIXTURES, dir), { language: name });
      expect(graph.totalFiles).toBe(Object.keys(graph.files).length);
    });

    it(`${name}: totalEdges should match edges.length`, async () => {
      const graph = await analyzeProject(join(FIXTURES, dir), { language: name });
      expect(graph.totalEdges).toBe(graph.edges.length);
    });

    it(`${name}: no self-referencing edges`, async () => {
      const graph = await analyzeProject(join(FIXTURES, dir), { language: name });
      for (const edge of graph.edges) {
        expect(edge.source).not.toBe(edge.target);
      }
    });
  }
});
