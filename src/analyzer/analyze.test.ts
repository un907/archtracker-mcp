import { describe, it, expect } from "vitest";
import { analyzeProject, AnalyzerError } from "./analyze.js";
import { join } from "node:path";

const FIXTURE_DIR = join(import.meta.dirname, "__fixtures__", "sample-project");

describe("analyzeProject", () => {
  it("should analyze a simple TypeScript project", async () => {
    const graph = await analyzeProject(FIXTURE_DIR, {
      exclude: ["circular"],
    });

    // index.ts + utils/greet.ts + utils/math.ts = at least 3
    expect(graph.totalFiles).toBeGreaterThanOrEqual(3);
    expect(graph.totalEdges).toBeGreaterThanOrEqual(2);
    expect(graph.rootDir).toBe(FIXTURE_DIR);
  });

  it("should detect dependencies between files", async () => {
    const graph = await analyzeProject(FIXTURE_DIR, {
      exclude: ["circular"],
    });

    // With baseDir, paths are relative to FIXTURE_DIR (e.g. "index.ts", "utils/greet.ts")
    const indexPath = Object.keys(graph.files).find((f) =>
      f.endsWith("index.ts"),
    );
    expect(indexPath).toBeDefined();

    const indexNode = graph.files[indexPath!];
    expect(indexNode.dependencies.length).toBeGreaterThanOrEqual(2);

    // utils/greet.ts should have index.ts as a dependent
    const greetPath = Object.keys(graph.files).find((f) =>
      f.includes("greet"),
    );
    expect(greetPath).toBeDefined();
    expect(graph.files[greetPath!].dependents).toContain(indexPath);
  });

  it("should build proper edge types", async () => {
    const graph = await analyzeProject(FIXTURE_DIR, {
      exclude: ["circular"],
    });

    expect(graph.edges.length).toBeGreaterThanOrEqual(2);
    for (const edge of graph.edges) {
      expect(["static", "dynamic", "type-only"]).toContain(edge.type);
      expect(edge.source).toBeTruthy();
      expect(edge.target).toBeTruthy();
    }
  });

  it("should detect circular dependencies", async () => {
    const graph = await analyzeProject(FIXTURE_DIR);

    expect(graph.circularDependencies.length).toBeGreaterThanOrEqual(1);

    const cycle = graph.circularDependencies[0];
    expect(cycle.cycle.length).toBeGreaterThanOrEqual(2);

    // The cycle should involve circular-a and circular-b
    const cycleStr = cycle.cycle.join(",");
    expect(cycleStr).toMatch(/circular/);
  });

  it("should respect exclude option", async () => {
    const graph = await analyzeProject(FIXTURE_DIR, {
      exclude: ["utils"],
    });

    const utilFiles = Object.keys(graph.files).filter((f) =>
      f.includes("utils"),
    );
    expect(utilFiles.length).toBe(0);
  });

  it("should throw AnalyzerError for nonexistent directory", async () => {
    await expect(
      analyzeProject("/nonexistent/path/that/does/not/exist"),
    ).rejects.toThrow(AnalyzerError);
  });
});
