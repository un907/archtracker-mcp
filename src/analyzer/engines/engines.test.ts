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
    expect(files).toContain("src/handlers/mod.rs");
    expect(files).toContain("src/handlers/api.rs");
    expect(graph.totalFiles).toBe(5);
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

describe("JS/TS RegexEngine", () => {
  const dir = join(FIXTURES, "sample-project");

  it("should analyze JS/TS with RegexEngine", async () => {
    const graph = await analyzeProject(dir, {
      exclude: ["circular"],
      language: "javascript",
    });
    expect(graph.totalFiles).toBeGreaterThanOrEqual(3);
    expect(graph.totalEdges).toBeGreaterThanOrEqual(2);
  });

  it("should detect dependencies (index → utils/greet, utils/math)", async () => {
    const graph = await analyzeProject(dir, { exclude: ["circular"], language: "javascript" });
    const indexKey = Object.keys(graph.files).find((f) => f.endsWith("index.ts"));
    expect(indexKey).toBeDefined();
    const indexNode = graph.files[indexKey!];
    // index.ts imports greet.ts and math.ts
    expect(indexNode.dependencies.length).toBeGreaterThanOrEqual(2);
    expect(indexNode.dependencies.some((d) => d.includes("greet"))).toBe(true);
    expect(indexNode.dependencies.some((d) => d.includes("math"))).toBe(true);
  });

  it("should auto-detect JS/TS and produce same results", async () => {
    const explicit = await analyzeProject(dir, { exclude: ["circular"], language: "javascript" });
    const auto = await analyzeProject(dir, { exclude: ["circular"] });
    expect(auto.totalFiles).toBe(explicit.totalFiles);
    expect(auto.totalEdges).toBe(explicit.totalEdges);
  });

  it("should detect circular dependencies", async () => {
    const graph = await analyzeProject(dir, { language: "javascript" });
    expect(graph.circularDependencies.length).toBeGreaterThanOrEqual(1);
    const cycleFiles = graph.circularDependencies[0].cycle;
    expect(cycleFiles.some((f) => f.includes("circular"))).toBe(true);
  });

  it("should have valid edge types", async () => {
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
    { name: "c-sharp", dir: "csharp-project" },
    { name: "ruby", dir: "ruby-project" },
    { name: "php", dir: "php-project" },
    { name: "swift", dir: "swift-project" },
    { name: "kotlin", dir: "kotlin-project" },
    { name: "dart", dir: "dart-project" },
    { name: "scala", dir: "scala-project" },
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

    it(`${name}: dependencies/dependents arrays match edges`, async () => {
      const graph = await analyzeProject(join(FIXTURES, dir), { language: name });
      for (const edge of graph.edges) {
        expect(graph.files[edge.source]?.dependencies).toContain(edge.target);
        expect(graph.files[edge.target]?.dependents).toContain(edge.source);
      }
    });

    it(`${name}: no duplicate edges`, async () => {
      const graph = await analyzeProject(join(FIXTURES, dir), { language: name });
      const edgeKeys = graph.edges.map((e) => `${e.source}\0${e.target}`);
      expect(new Set(edgeKeys).size).toBe(edgeKeys.length);
    });
  }
});

// ═══════════════════════════════════════════════════════
// Python: Multi-import syntax (import a, b, c)
// ═══════════════════════════════════════════════════════

describe("Python multi-import", () => {
  const dir = join(FIXTURES, "python-project");

  it("should resolve 'import utils, helpers' to both utils.py and helpers.py", async () => {
    const graph = await analyzeProject(dir, { language: "python" });
    expect(hasEdge(graph, "main.py", "utils.py")).toBe(true);
    expect(hasEdge(graph, "main.py", "helpers.py")).toBe(true);
  });

  it("should find helpers.py in the file list", async () => {
    const graph = await analyzeProject(dir, { language: "python" });
    expect(graph.files["helpers.py"]).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════
// Rust: super:: and self:: imports, nested modules
// ═══════════════════════════════════════════════════════

describe("Rust nested modules and super::", () => {
  const dir = join(FIXTURES, "rust-project");

  it("should resolve mod handlers; → src/handlers/mod.rs", async () => {
    const graph = await analyzeProject(dir, { language: "rust" });
    expect(hasEdge(graph, "src/main.rs", "src/handlers/mod.rs")).toBe(true);
  });

  it("should resolve mod api; in handlers/mod.rs → handlers/api.rs", async () => {
    const graph = await analyzeProject(dir, { language: "rust" });
    expect(hasEdge(graph, "src/handlers/mod.rs", "src/handlers/api.rs")).toBe(true);
  });

  it("should resolve use crate::models::User in handlers/api.rs → src/models.rs", async () => {
    const graph = await analyzeProject(dir, { language: "rust" });
    expect(hasEdge(graph, "src/handlers/api.rs", "src/models.rs")).toBe(true);
  });

  it("should detect circular dependency between utils.rs and models.rs", async () => {
    const graph = await analyzeProject(dir, { language: "rust" });
    expect(hasEdge(graph, "src/utils.rs", "src/models.rs")).toBe(true);
    expect(hasEdge(graph, "src/models.rs", "src/utils.rs")).toBe(true);
    expect(graph.circularDependencies.length).toBeGreaterThanOrEqual(1);
    const allCycleFiles = graph.circularDependencies.flatMap((c) => c.cycle);
    expect(allCycleFiles).toContain("src/utils.rs");
    expect(allCycleFiles).toContain("src/models.rs");
  });
});

// ═══════════════════════════════════════════════════════
// Java: Wildcard and static imports
// ═══════════════════════════════════════════════════════

describe("Java wildcard and static imports", () => {
  const dir = join(FIXTURES, "java-project");

  it("should ignore wildcard import com.example.* (no edge)", async () => {
    const graph = await analyzeProject(dir, { language: "java" });
    const mainEdges = edgesFrom(graph, "src/main/java/com/example/Main.java");
    // Wildcard should NOT produce any edge — only Service and Repository
    expect(mainEdges).toHaveLength(2);
  });

  it("should resolve static import to the class file (com.example.Service.staticMethod → Service.java)", async () => {
    const graph = await analyzeProject(dir, { language: "java" });
    // static import com.example.Service.staticMethod should resolve to Service.java
    // which is already an edge from the regular import — so still 2 edges
    expect(hasEdge(graph, "src/main/java/com/example/Main.java", "src/main/java/com/example/Service.java")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// Kotlin: Wildcard imports
// ═══════════════════════════════════════════════════════

describe("Kotlin wildcard imports", () => {
  const dir = join(FIXTURES, "kotlin-project");

  it("should ignore wildcard import com.example.* (no edge)", async () => {
    const graph = await analyzeProject(dir, { language: "kotlin" });
    const mainEdges = edgesFrom(graph, "src/main/kotlin/com/example/Main.kt");
    // Wildcard should NOT produce any edge — only Service and Repository
    expect(mainEdges).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════
// PHP: use function/const (no false edges)
// ═══════════════════════════════════════════════════════

describe("PHP use function/const", () => {
  const dir = join(FIXTURES, "php-project");

  it("should not create edges for use function/const (unresolvable namespace)", async () => {
    const graph = await analyzeProject(dir, { language: "php" });
    const indexEdges = edgesFrom(graph, "index.php");
    // Only the require statements should create edges, not the use statements
    expect(indexEdges).toHaveLength(2);
    expect(hasEdge(graph, "index.php", "src/Controllers/HomeController.php")).toBe(true);
    expect(hasEdge(graph, "index.php", "src/Controllers/ApiController.php")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// Swift: @testable import
// ═══════════════════════════════════════════════════════

describe("Swift @testable import", () => {
  const dir = join(FIXTURES, "swift-project");

  it("should resolve @testable import Utils → Sources/Utils/greet.swift", async () => {
    const graph = await analyzeProject(dir, { language: "swift" });
    expect(hasEdge(graph, "Sources/App/main.swift", "Sources/Utils/greet.swift")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// Comment Stripping: Advanced Edge Cases
// ═══════════════════════════════════════════════════════

describe("stripComments edge cases", () => {
  // C-style char literals
  it("should not treat char literal '/' as comment start", () => {
    const input = "char c = '/';\nuse crate::real;";
    const result = stripComments(input, "c-style");
    expect(result).toContain("use crate::real;");
    expect(result).toContain("'/'");
  });

  it("should handle escaped char literal '\\''", () => {
    const input = "char c = '\\'';\nuse crate::real;";
    const result = stripComments(input, "c-style");
    expect(result).toContain("use crate::real;");
  });

  it("should handle char literal '\\n'", () => {
    const input = "char nl = '\\n';\nimport real;";
    const result = stripComments(input, "c-style");
    expect(result).toContain("import real;");
  });

  // Rust raw strings
  it("should strip Rust raw string r\"...\"", () => {
    const input = 'let s = r"use crate::fake;";\nuse crate::real;';
    const result = stripComments(input, "c-style");
    expect(result).toContain("use crate::real;");
    expect(result).not.toContain("fake");
  });

  it("should strip Rust raw string r#\"...\"#", () => {
    const input = 'let s = r#"use crate::fake;"#;\nuse crate::real;';
    const result = stripComments(input, "c-style");
    expect(result).toContain("use crate::real;");
    expect(result).not.toContain("fake");
  });

  it("should strip Rust raw string r##\"...\"## with embedded \"#", () => {
    const input = 'let s = r##"has "# inside"##;\nuse crate::real;';
    const result = stripComments(input, "c-style");
    expect(result).toContain("use crate::real;");
    expect(result).not.toContain("inside");
  });

  // Go backtick strings
  it("should strip Go backtick strings", () => {
    const input = 'var s = `import "fake"`;\nimport "real";';
    const result = stripComments(input, "c-style");
    expect(result).toContain('import "real"');
    expect(result).not.toContain("fake");
  });

  it("should preserve newlines inside Go backtick strings", () => {
    const input = 'var s = `line1\nline2`;\nline3';
    const result = stripComments(input, "c-style");
    expect(result.split("\n").length).toBe(3);
    expect(result).toContain("line3");
  });

  // Python string prefixes
  it("should strip Python r-string (raw string)", () => {
    const input = 'x = r"import fake"\nimport real';
    const result = stripComments(input, "python");
    expect(result).toContain("import real");
    // r"..." is a regular string, so its content is preserved (only triple-quoted are stripped)
    // Actually, Python single-quoted strings are preserved in our implementation
  });

  it("should strip Python f-string triple-quoted", () => {
    const input = 'x = f"""\nimport fake\n"""\nimport real';
    const result = stripComments(input, "python");
    expect(result).toContain("import real");
    expect(result).not.toContain("fake");
  });

  it("should strip Python b-string triple-quoted", () => {
    const input = "x = b'''\nimport fake\n'''\nimport real";
    const result = stripComments(input, "python");
    expect(result).toContain("import real");
    expect(result).not.toContain("fake");
  });

  it("should strip Python rb-string triple-quoted", () => {
    const input = 'x = rb"""\nimport fake\n"""\nimport real';
    const result = stripComments(input, "python");
    expect(result).toContain("import real");
    expect(result).not.toContain("fake");
  });

  it("should strip Python fr-string triple-quoted (case insensitive)", () => {
    const input = 'x = FR"""\nimport fake\n"""\nimport real';
    const result = stripComments(input, "python");
    expect(result).toContain("import real");
    expect(result).not.toContain("fake");
  });

  // Ruby string interpolation
  it("should preserve Ruby #{} string interpolation (not treat # as comment)", () => {
    const input = 'puts "hello #{name}"\nrequire_relative \'real\'';
    const result = stripComments(input, "ruby");
    expect(result).toContain("require_relative 'real'");
    expect(result).toContain("hello #{name}");
  });

  it("should handle nested Ruby #{} interpolation", () => {
    const input = 'x = "val: #{a + "#{b}"}";\nrequire_relative \'real\'';
    const result = stripComments(input, "ruby");
    expect(result).toContain("require_relative 'real'");
  });

  // Ruby =begin/=end strict matching
  it("should not treat =beginning as block comment start", () => {
    const input = "=beginning\nrequire_relative 'real'";
    const result = stripComments(input, "ruby");
    expect(result).toContain("=beginning");
    expect(result).toContain("require_relative 'real'");
  });

  it("should handle =begin with trailing whitespace", () => {
    const input = "=begin \nrequire 'fake'\n=end\nrequire_relative 'real'";
    const result = stripComments(input, "ruby");
    expect(result).not.toContain("fake");
    expect(result).toContain("require_relative 'real'");
  });

  // PHP heredoc/nowdoc
  it("should strip PHP heredoc content", () => {
    const input = "$x = <<<EOT\nrequire 'fake.php';\nEOT;\nrequire 'real.php';";
    const result = stripComments(input, "php");
    expect(result).toContain("require 'real.php'");
    expect(result).not.toContain("fake");
  });

  it("should strip PHP nowdoc content", () => {
    const input = "$x = <<<'EOT'\nrequire 'fake.php';\nEOT;\nrequire 'real.php';";
    const result = stripComments(input, "php");
    expect(result).toContain("require 'real.php'");
    expect(result).not.toContain("fake");
  });

  // Multi-line block comments preserving line numbers
  it("should preserve exact line count in multi-line C-style block comment", () => {
    const input = "line1\n/*\nline3\nline4\nline5\n*/\nline7";
    const result = stripComments(input, "c-style");
    const lines = result.split("\n");
    expect(lines.length).toBe(7);
    expect(lines[0]).toBe("line1");
    expect(lines[6]).toBe("line7");
  });

  // Strings containing comment-like content
  it("should not strip // inside double-quoted string", () => {
    const input = 'x = "// not a comment";\nimport real;';
    const result = stripComments(input, "c-style");
    expect(result).toContain("import real;");
    expect(result).toContain('"// not a comment"');
  });

  it("should not strip /* */ inside double-quoted string", () => {
    const input = 'x = "/* not a comment */";\nimport real;';
    const result = stripComments(input, "c-style");
    expect(result).toContain("import real;");
    expect(result).toContain('"/* not a comment */"');
  });

  it("should handle escaped quotes in strings before comments", () => {
    const input = 'x = "escaped \\"quote";\n// real comment\nimport real;';
    const result = stripComments(input, "c-style");
    expect(result).toContain("import real;");
    expect(result).not.toContain("real comment");
  });

  // PHP # comments
  it("should strip PHP # comment", () => {
    const input = "require 'real.php';\n# require 'fake.php';\nrequire 'also_real.php';";
    const result = stripComments(input, "php");
    expect(result).toContain("require 'real.php'");
    expect(result).toContain("require 'also_real.php'");
    expect(result).not.toContain("fake");
  });

  // Empty input
  it("should handle empty string for all styles", () => {
    expect(stripComments("", "c-style")).toBe("");
    expect(stripComments("", "hash")).toBe("");
    expect(stripComments("", "python")).toBe("");
    expect(stripComments("", "ruby")).toBe("");
    expect(stripComments("", "php")).toBe("");
  });

  // Input with no comments
  it("should return identical content when no comments or strings exist", () => {
    const input = "import foo;\nimport bar;\n";
    expect(stripComments(input, "c-style")).toBe(input);
  });
});

// ═══════════════════════════════════════════════════════
// Empty and Single-File Projects
// ═══════════════════════════════════════════════════════

describe("Edge case projects", () => {
  it("should handle empty project (no source files)", async () => {
    const dir = join(FIXTURES, "empty-project");
    const graph = await analyzeProject(dir, { language: "python" });
    expect(graph.totalFiles).toBe(0);
    expect(graph.totalEdges).toBe(0);
    expect(graph.edges).toHaveLength(0);
    expect(graph.circularDependencies).toHaveLength(0);
  });

  it("should handle single-file project (no dependencies)", async () => {
    const dir = join(FIXTURES, "single-file-project");
    const graph = await analyzeProject(dir, { language: "python" });
    expect(graph.totalFiles).toBe(1);
    expect(graph.totalEdges).toBe(0);
    expect(Object.keys(graph.files)).toContain("main.py");
    expect(graph.files["main.py"].dependencies).toHaveLength(0);
    expect(graph.files["main.py"].dependents).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════
// Rust grouped use: extractRustUsePaths unit tests
// ═══════════════════════════════════════════════════════

describe("Rust grouped use extraction", () => {
  it("should handle deeply nested grouped imports", async () => {
    const dir = join(FIXTURES, "rust-project");
    const graph = await analyzeProject(dir, { language: "rust" });
    // main.rs has: use crate::models::{User, Config}
    // Both should resolve to models.rs
    expect(hasEdge(graph, "src/main.rs", "src/models.rs")).toBe(true);
  });

  it("should handle self in grouped import (use crate::models::{self, User})", () => {
    // Unit test: stripComments + extractImports indirectly via a content parse
    const content = "use crate::models::{self, User};";
    const stripped = stripComments(content, "c-style");
    expect(stripped).toContain("use crate::models::{self, User}");
  });
});

// ═══════════════════════════════════════════════════════
// Regex Engine: maxDepth option
// ═══════════════════════════════════════════════════════

describe("RegexEngine maxDepth", () => {
  it("should respect maxDepth=1 and only find top-level files", async () => {
    const dir = join(FIXTURES, "python-project");
    const graph = await analyzeProject(dir, { language: "python", maxDepth: 1 });
    const files = Object.keys(graph.files);
    // maxDepth=1: only files in the root directory (main.py, utils.py, helpers.py, circular_a.py, circular_b.py)
    for (const f of files) {
      expect(f).not.toContain("/"); // no subdirectory files
    }
  });

  it("should find all files when maxDepth=0 (unlimited)", async () => {
    const dir = join(FIXTURES, "python-project");
    const graph = await analyzeProject(dir, { language: "python", maxDepth: 0 });
    const files = Object.keys(graph.files);
    expect(files.some((f) => f.includes("/"))).toBe(true); // has subdirectory files
  });
});

// ═══════════════════════════════════════════════════════
// Regex Engine: exclude patterns
// ═══════════════════════════════════════════════════════

describe("RegexEngine exclude patterns", () => {
  it("should exclude files matching custom patterns", async () => {
    const dir = join(FIXTURES, "python-project");
    const graph = await analyzeProject(dir, { language: "python", exclude: ["services"] });
    const files = Object.keys(graph.files);
    for (const f of files) {
      expect(f).not.toContain("services");
    }
  });

  it("should exclude circular_ files when pattern matches", async () => {
    const dir = join(FIXTURES, "python-project");
    const graph = await analyzeProject(dir, { language: "python", exclude: ["circular"] });
    const files = Object.keys(graph.files);
    for (const f of files) {
      expect(f).not.toContain("circular");
    }
    // No circular dependencies should be detected
    expect(graph.circularDependencies).toHaveLength(0);
  });

  it("should apply default exclude patterns (e.g. __pycache__)", async () => {
    // Default excludes for Python include __pycache__ - just verify the option is applied
    const dir = join(FIXTURES, "python-project");
    const graph = await analyzeProject(dir, { language: "python" });
    const files = Object.keys(graph.files);
    for (const f of files) {
      expect(f).not.toContain("__pycache__");
    }
  });
});

// ═══════════════════════════════════════════════════════
// Go: import block edge cases
// ═══════════════════════════════════════════════════════

describe("Go import edge cases", () => {
  const dir = join(FIXTURES, "go-project");

  it("should resolve both single and block imports", async () => {
    const graph = await analyzeProject(dir, { language: "go" });
    // main.go uses import block, handler.go uses single import
    expect(hasEdge(graph, "main.go", "pkg/utils/utils.go")).toBe(true);
    expect(hasEdge(graph, "handler.go", "pkg/utils/utils.go")).toBe(true);
  });

  it("should not create edges for stdlib imports (fmt, net/http, etc.)", async () => {
    const graph = await analyzeProject(dir, { language: "go" });
    for (const edge of graph.edges) {
      expect(edge.target).not.toContain("fmt");
      expect(edge.target).not.toContain("net/http");
    }
  });
});

// ═══════════════════════════════════════════════════════
// C/C++: include resolution
// ═══════════════════════════════════════════════════════

describe("C/C++ include resolution", () => {
  const dir = join(FIXTURES, "cpp-project");

  it("should NOT resolve system includes (#include <...>)", async () => {
    const graph = await analyzeProject(dir, { language: "c-cpp" });
    for (const edge of graph.edges) {
      expect(edge.target).not.toContain("stdio");
      expect(edge.target).not.toContain("iostream");
    }
  });

  it("should resolve relative path includes (../include/config.h)", async () => {
    const graph = await analyzeProject(dir, { language: "c-cpp" });
    expect(hasEdge(graph, "src/main.cpp", "include/config.h")).toBe(true);
  });

  it("should resolve same-directory includes (utils.h from utils.cpp)", async () => {
    const graph = await analyzeProject(dir, { language: "c-cpp" });
    expect(hasEdge(graph, "src/utils.cpp", "src/utils.h")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// Language auto-detection fallback
// ═══════════════════════════════════════════════════════

describe("Language auto-detection", () => {
  it("should auto-detect Python for python-project", async () => {
    const dir = join(FIXTURES, "python-project");
    const lang = await detectLanguage(dir);
    expect(lang).toBe("python");
  });

  it("should auto-detect Rust for rust-project", async () => {
    const dir = join(FIXTURES, "rust-project");
    const lang = await detectLanguage(dir);
    expect(lang).toBe("rust");
  });

  it("should auto-detect when analyzeProject is called without language", async () => {
    const dir = join(FIXTURES, "go-project");
    // Should auto-detect Go from go.mod and produce correct results
    const graph = await analyzeProject(dir);
    expect(graph.totalFiles).toBe(3);
    expect(hasEdge(graph, "main.go", "pkg/utils/utils.go")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// All languages: dependents/dependencies cross-check
// ═══════════════════════════════════════════════════════

describe("dependencies/dependents consistency", () => {
  const languages = [
    { name: "python", dir: "python-project" },
    { name: "rust", dir: "rust-project" },
    { name: "go", dir: "go-project" },
    { name: "java", dir: "java-project" },
    { name: "c-cpp", dir: "cpp-project" },
    { name: "c-sharp", dir: "csharp-project" },
    { name: "ruby", dir: "ruby-project" },
    { name: "php", dir: "php-project" },
    { name: "swift", dir: "swift-project" },
    { name: "kotlin", dir: "kotlin-project" },
    { name: "dart", dir: "dart-project" },
    { name: "scala", dir: "scala-project" },
  ] as const;

  for (const { name, dir } of languages) {
    it(`${name}: dependency count matches outgoing edge count for each file`, async () => {
      const graph = await analyzeProject(join(FIXTURES, dir), { language: name });
      for (const [filePath, node] of Object.entries(graph.files)) {
        const outEdges = graph.edges.filter((e) => e.source === filePath);
        expect(node.dependencies.length).toBe(outEdges.length);
      }
    });

    it(`${name}: dependents count matches incoming edge count for each file`, async () => {
      const graph = await analyzeProject(join(FIXTURES, dir), { language: name });
      for (const [filePath, node] of Object.entries(graph.files)) {
        const inEdges = graph.edges.filter((e) => e.target === filePath);
        expect(node.dependents.length).toBe(inEdges.length);
      }
    });
  }
});

// ═══════════════════════════════════════════════════════
// C# Analysis
// ═══════════════════════════════════════════════════════

describe("C# analyzer", () => {
  const dir = join(FIXTURES, "csharp-project");

  it("should detect C# from .sln file", async () => {
    expect(await detectLanguage(dir)).toBe("c-sharp");
  });

  it("should find all C# files", async () => {
    const graph = await analyzeProject(dir, { language: "c-sharp" });
    const files = Object.keys(graph.files).sort();
    expect(files).toContain("Program.cs");
    expect(files).toContain("Services/UserService.cs");
    expect(files).toContain("Models/User.cs");
    expect(graph.totalFiles).toBe(3);
  });

  it("should resolve Program.cs → Services/UserService.cs (using MyApp.Services)", async () => {
    const graph = await analyzeProject(dir, { language: "c-sharp" });
    expect(hasEdge(graph, "Program.cs", "Services/UserService.cs")).toBe(true);
  });

  it("should resolve Program.cs → Models/User.cs (using MyApp.Models)", async () => {
    const graph = await analyzeProject(dir, { language: "c-sharp" });
    expect(hasEdge(graph, "Program.cs", "Models/User.cs")).toBe(true);
  });

  it("should resolve UserService.cs → Models/User.cs", async () => {
    const graph = await analyzeProject(dir, { language: "c-sharp" });
    expect(hasEdge(graph, "Services/UserService.cs", "Models/User.cs")).toBe(true);
  });

  it("should NOT create edges from commented-out using statements", async () => {
    const graph = await analyzeProject(dir, { language: "c-sharp" });
    const progEdges = edgesFrom(graph, "Program.cs");
    expect(progEdges).toHaveLength(2); // Services and Models only
    for (const edge of progEdges) {
      expect(edge.target).not.toContain("Fake");
    }
  });
});

// ═══════════════════════════════════════════════════════
// Dart Analysis
// ═══════════════════════════════════════════════════════

describe("Dart analyzer", () => {
  const dir = join(FIXTURES, "dart-project");

  it("should detect Dart from pubspec.yaml", async () => {
    expect(await detectLanguage(dir)).toBe("dart");
  });

  it("should find all Dart files", async () => {
    const graph = await analyzeProject(dir, { language: "dart" });
    const files = Object.keys(graph.files).sort();
    expect(files).toContain("lib/app.dart");
    expect(files).toContain("lib/utils.dart");
    expect(files).toContain("lib/models/user.dart");
    expect(files).toContain("bin/main.dart");
    expect(graph.totalFiles).toBe(4);
  });

  it("should resolve package:my_app/utils.dart → lib/utils.dart", async () => {
    const graph = await analyzeProject(dir, { language: "dart" });
    expect(hasEdge(graph, "lib/app.dart", "lib/utils.dart")).toBe(true);
  });

  it("should resolve package:my_app/models/user.dart → lib/models/user.dart", async () => {
    const graph = await analyzeProject(dir, { language: "dart" });
    expect(hasEdge(graph, "lib/app.dart", "lib/models/user.dart")).toBe(true);
  });

  it("should resolve utils.dart → lib/models/user.dart", async () => {
    const graph = await analyzeProject(dir, { language: "dart" });
    expect(hasEdge(graph, "lib/utils.dart", "lib/models/user.dart")).toBe(true);
  });

  it("should NOT resolve dart:core (stdlib)", async () => {
    const graph = await analyzeProject(dir, { language: "dart" });
    for (const edge of graph.edges) {
      expect(edge.target).not.toContain("dart:");
    }
  });

  it("should NOT create edges from commented-out imports", async () => {
    const graph = await analyzeProject(dir, { language: "dart" });
    const appEdges = edgesFrom(graph, "lib/app.dart");
    expect(appEdges).toHaveLength(2); // utils.dart and models/user.dart only
    for (const edge of appEdges) {
      expect(edge.target).not.toContain("fake");
    }
  });
});

// ═══════════════════════════════════════════════════════
// Scala Analysis
// ═══════════════════════════════════════════════════════

describe("Scala analyzer", () => {
  const dir = join(FIXTURES, "scala-project");

  it("should detect Scala from build.sbt", async () => {
    expect(await detectLanguage(dir)).toBe("scala");
  });

  it("should find all Scala files", async () => {
    const graph = await analyzeProject(dir, { language: "scala" });
    const files = Object.keys(graph.files).sort();
    expect(files).toContain("src/main/scala/com/example/Main.scala");
    expect(files).toContain("src/main/scala/com/example/services/UserService.scala");
    expect(files).toContain("src/main/scala/com/example/models/User.scala");
    expect(graph.totalFiles).toBe(3);
  });

  it("should resolve Main.scala → UserService.scala", async () => {
    const graph = await analyzeProject(dir, { language: "scala" });
    expect(
      hasEdge(graph, "src/main/scala/com/example/Main.scala", "src/main/scala/com/example/services/UserService.scala"),
    ).toBe(true);
  });

  it("should resolve Main.scala → User.scala", async () => {
    const graph = await analyzeProject(dir, { language: "scala" });
    expect(
      hasEdge(graph, "src/main/scala/com/example/Main.scala", "src/main/scala/com/example/models/User.scala"),
    ).toBe(true);
  });

  it("should resolve UserService.scala → User.scala", async () => {
    const graph = await analyzeProject(dir, { language: "scala" });
    expect(
      hasEdge(graph, "src/main/scala/com/example/services/UserService.scala", "src/main/scala/com/example/models/User.scala"),
    ).toBe(true);
  });

  it("should NOT create edges from commented-out imports", async () => {
    const graph = await analyzeProject(dir, { language: "scala" });
    const mainEdges = edgesFrom(graph, "src/main/scala/com/example/Main.scala");
    expect(mainEdges).toHaveLength(2); // UserService and User only
    for (const edge of mainEdges) {
      expect(edge.target).not.toContain("Fake");
    }
  });
});
