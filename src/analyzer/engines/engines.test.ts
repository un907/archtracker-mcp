import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { analyzeProject } from "../analyze.js";
import { detectLanguage } from "./detect.js";
import { detectCycles } from "./cycle.js";
import type { DependencyEdge } from "../../types/schema.js";

const FIXTURES = join(import.meta.dirname, "..", "__fixtures__");

// ─── Language Detection ──────────────────────────────

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

// ─── Cycle Detection ─────────────────────────────────

describe("detectCycles", () => {
  it("should detect a simple cycle", () => {
    const edges: DependencyEdge[] = [
      { source: "a.py", target: "b.py", type: "static" },
      { source: "b.py", target: "a.py", type: "static" },
    ];
    const cycles = detectCycles(edges);
    expect(cycles.length).toBe(1);
    expect(cycles[0].cycle).toContain("a.py");
    expect(cycles[0].cycle).toContain("b.py");
  });

  it("should return empty for acyclic graph", () => {
    const edges: DependencyEdge[] = [
      { source: "a.py", target: "b.py", type: "static" },
      { source: "b.py", target: "c.py", type: "static" },
    ];
    expect(detectCycles(edges)).toHaveLength(0);
  });

  it("should deduplicate cycles", () => {
    const edges: DependencyEdge[] = [
      { source: "a", target: "b", type: "static" },
      { source: "b", target: "c", type: "static" },
      { source: "c", target: "a", type: "static" },
    ];
    const cycles = detectCycles(edges);
    expect(cycles.length).toBe(1);
  });
});

// ─── Python Analysis ─────────────────────────────────

describe("Python analyzer", () => {
  const dir = join(FIXTURES, "python-project");

  it("should find Python files", async () => {
    const graph = await analyzeProject(dir, { language: "python" });
    expect(graph.totalFiles).toBeGreaterThanOrEqual(3);
  });

  it("should detect Python imports", async () => {
    const graph = await analyzeProject(dir, { language: "python" });
    expect(graph.totalEdges).toBeGreaterThanOrEqual(1);
  });

  it("should resolve relative imports", async () => {
    const graph = await analyzeProject(dir, { language: "python" });
    // main.py imports utils → should have edge
    const mainEdges = graph.edges.filter((e) => e.source.includes("main"));
    expect(mainEdges.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Rust Analysis ───────────────────────────────────

describe("Rust analyzer", () => {
  const dir = join(FIXTURES, "rust-project");

  it("should find Rust files", async () => {
    const graph = await analyzeProject(dir, { language: "rust" });
    expect(graph.totalFiles).toBe(2); // main.rs, utils.rs
  });

  it("should detect mod declarations", async () => {
    const graph = await analyzeProject(dir, { language: "rust" });
    // main.rs has `mod utils;`
    const mainEdges = graph.edges.filter((e) => e.source.includes("main"));
    expect(mainEdges.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Go Analysis ─────────────────────────────────────

describe("Go analyzer", () => {
  const dir = join(FIXTURES, "go-project");

  it("should find Go files", async () => {
    const graph = await analyzeProject(dir, { language: "go" });
    expect(graph.totalFiles).toBe(2); // main.go, pkg/utils/utils.go
  });

  it("should resolve internal package imports", async () => {
    const graph = await analyzeProject(dir, { language: "go" });
    expect(graph.totalEdges).toBeGreaterThanOrEqual(1);
  });
});

// ─── Java Analysis ───────────────────────────────────

describe("Java analyzer", () => {
  const dir = join(FIXTURES, "java-project");

  it("should find Java files", async () => {
    const graph = await analyzeProject(dir, { language: "java" });
    expect(graph.totalFiles).toBe(2); // Main.java, Service.java
  });

  it("should detect Java imports", async () => {
    const graph = await analyzeProject(dir, { language: "java" });
    // Main.java imports com.example.Service
    expect(graph.totalEdges).toBeGreaterThanOrEqual(1);
  });
});

// ─── C/C++ Analysis ──────────────────────────────────

describe("C/C++ analyzer", () => {
  const dir = join(FIXTURES, "cpp-project");

  it("should find C/C++ files", async () => {
    const graph = await analyzeProject(dir, { language: "c-cpp" });
    expect(graph.totalFiles).toBeGreaterThanOrEqual(3); // main.cpp, utils.h, utils.cpp, config.h
  });

  it("should resolve #include directives", async () => {
    const graph = await analyzeProject(dir, { language: "c-cpp" });
    // main.cpp includes utils.h and config.h
    expect(graph.totalEdges).toBeGreaterThanOrEqual(2);
  });
});

// ─── Ruby Analysis ───────────────────────────────────

describe("Ruby analyzer", () => {
  const dir = join(FIXTURES, "ruby-project");

  it("should find Ruby files", async () => {
    const graph = await analyzeProject(dir, { language: "ruby" });
    expect(graph.totalFiles).toBe(2); // app.rb, lib/helper.rb
  });

  it("should resolve require_relative", async () => {
    const graph = await analyzeProject(dir, { language: "ruby" });
    expect(graph.totalEdges).toBeGreaterThanOrEqual(1);
  });
});

// ─── PHP Analysis ────────────────────────────────────

describe("PHP analyzer", () => {
  const dir = join(FIXTURES, "php-project");

  it("should find PHP files", async () => {
    const graph = await analyzeProject(dir, { language: "php" });
    expect(graph.totalFiles).toBe(2);
  });

  it("should resolve require paths", async () => {
    const graph = await analyzeProject(dir, { language: "php" });
    expect(graph.totalEdges).toBeGreaterThanOrEqual(1);
  });
});

// ─── Swift Analysis ──────────────────────────────────

describe("Swift analyzer", () => {
  const dir = join(FIXTURES, "swift-project");

  it("should find Swift files", async () => {
    const graph = await analyzeProject(dir, { language: "swift" });
    expect(graph.totalFiles).toBe(3); // Package.swift, main.swift, greet.swift
  });
});

// ─── Kotlin Analysis ─────────────────────────────────

describe("Kotlin analyzer", () => {
  const dir = join(FIXTURES, "kotlin-project");

  it("should find Kotlin files", async () => {
    const graph = await analyzeProject(dir, { language: "kotlin" });
    expect(graph.totalFiles).toBe(2); // Main.kt, Service.kt
  });

  it("should detect Kotlin imports", async () => {
    const graph = await analyzeProject(dir, { language: "kotlin" });
    expect(graph.totalEdges).toBeGreaterThanOrEqual(1);
  });
});

// ─── Backward Compatibility ─────────────────────────

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
    const graph = await analyzeProject(dir, { exclude: ["circular"] });
    expect(graph.totalFiles).toBeGreaterThanOrEqual(3);
  });
});
