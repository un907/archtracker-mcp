import { describe, it, expect } from "vitest";
import { searchByPath, findAffectedFiles, findCriticalFiles, findOrphanFiles } from "./search.js";
import type { DependencyGraph } from "../types/schema.js";
import { setLocale } from "../i18n/index.js";

// Use English locale for predictable test assertions
setLocale("en");

function makeGraph(overrides?: Partial<DependencyGraph>): DependencyGraph {
  return {
    rootDir: "/project",
    files: {
      "src/index.ts": {
        path: "src/index.ts",
        exists: true,
        dependencies: ["src/utils.ts", "src/lib/api.ts"],
        dependents: [],
      },
      "src/utils.ts": {
        path: "src/utils.ts",
        exists: true,
        dependencies: [],
        dependents: ["src/index.ts", "src/lib/api.ts"],
      },
      "src/lib/api.ts": {
        path: "src/lib/api.ts",
        exists: true,
        dependencies: ["src/utils.ts"],
        dependents: ["src/index.ts"],
      },
      "src/orphan.ts": {
        path: "src/orphan.ts",
        exists: true,
        dependencies: [],
        dependents: [],
      },
    },
    edges: [],
    circularDependencies: [],
    totalFiles: 4,
    totalEdges: 3,
    ...overrides,
  };
}

describe("searchByPath", () => {
  it("finds files matching a substring pattern", () => {
    const graph = makeGraph();
    const results = searchByPath(graph, "utils");
    expect(results).toHaveLength(1);
    expect(results[0].file).toBe("src/utils.ts");
    expect(results[0].matchReason).toContain("utils");
  });

  it("is case-insensitive", () => {
    const graph = makeGraph();
    const results = searchByPath(graph, "UTILS");
    expect(results).toHaveLength(1);
    expect(results[0].file).toBe("src/utils.ts");
  });

  it("escapes regex metacharacters (ReDoS prevention)", () => {
    const graph = makeGraph();
    // Should not throw or match incorrectly
    const results = searchByPath(graph, "src/lib/api.ts");
    expect(results).toHaveLength(1);
    expect(results[0].file).toBe("src/lib/api.ts");
  });

  it("returns empty array when no match", () => {
    const graph = makeGraph();
    const results = searchByPath(graph, "nonexistent");
    expect(results).toHaveLength(0);
  });

  it("matches multiple files", () => {
    const graph = makeGraph();
    const results = searchByPath(graph, "src/");
    expect(results).toHaveLength(4);
  });

  it("includes dependency/dependent counts", () => {
    const graph = makeGraph();
    const results = searchByPath(graph, "utils");
    expect(results[0].dependentCount).toBe(2);
    expect(results[0].dependencyCount).toBe(0);
    expect(results[0].dependents).toEqual(["src/index.ts", "src/lib/api.ts"]);
  });
});

describe("findAffectedFiles", () => {
  it("finds direct dependents of a file", () => {
    const graph = makeGraph();
    const results = findAffectedFiles(graph, "src/utils.ts");
    const affected = results.map((r) => r.file);
    expect(affected).toContain("src/index.ts");
    expect(affected).toContain("src/lib/api.ts");
  });

  it("does not include the queried file itself", () => {
    const graph = makeGraph();
    const results = findAffectedFiles(graph, "src/utils.ts");
    expect(results.map((r) => r.file)).not.toContain("src/utils.ts");
  });

  it("returns empty for files with no dependents", () => {
    const graph = makeGraph();
    const results = findAffectedFiles(graph, "src/orphan.ts");
    expect(results).toHaveLength(0);
  });

  it("returns empty for nonexistent files", () => {
    const graph = makeGraph();
    const results = findAffectedFiles(graph, "nonexistent.ts");
    expect(results).toHaveLength(0);
  });

  it("finds files by partial path", () => {
    const graph = makeGraph();
    const results = findAffectedFiles(graph, "utils.ts");
    expect(results.length).toBeGreaterThan(0);
  });

  it("respects maxDepth", () => {
    const graph = makeGraph();
    // With maxDepth=1, only direct dependents of utils.ts
    const results = findAffectedFiles(graph, "src/utils.ts", 1);
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("findCriticalFiles", () => {
  it("returns files sorted by dependent count", () => {
    const graph = makeGraph();
    const results = findCriticalFiles(graph);
    expect(results.length).toBeGreaterThan(0);
    // utils.ts has 2 dependents, api.ts has 1
    expect(results[0].file).toBe("src/utils.ts");
    expect(results[0].dependentCount).toBe(2);
  });

  it("excludes files with no dependents", () => {
    const graph = makeGraph();
    const results = findCriticalFiles(graph);
    const files = results.map((r) => r.file);
    expect(files).not.toContain("src/orphan.ts");
    expect(files).not.toContain("src/index.ts");
  });

  it("respects limit parameter", () => {
    const graph = makeGraph();
    const results = findCriticalFiles(graph, 1);
    expect(results).toHaveLength(1);
    expect(results[0].file).toBe("src/utils.ts");
  });

  it("matchReason includes dependent count", () => {
    const graph = makeGraph();
    const results = findCriticalFiles(graph);
    expect(results[0].matchReason).toContain("2");
  });
});

describe("findOrphanFiles", () => {
  it("finds files with no dependencies and no dependents", () => {
    const graph = makeGraph();
    const results = findOrphanFiles(graph);
    expect(results).toHaveLength(1);
    expect(results[0].file).toBe("src/orphan.ts");
  });

  it("does not include files with dependencies", () => {
    const graph = makeGraph();
    const results = findOrphanFiles(graph);
    const files = results.map((r) => r.file);
    expect(files).not.toContain("src/index.ts");
  });

  it("does not include files with dependents", () => {
    const graph = makeGraph();
    const results = findOrphanFiles(graph);
    const files = results.map((r) => r.file);
    expect(files).not.toContain("src/utils.ts");
  });

  it("returns empty when no orphans exist", () => {
    const graph = makeGraph({
      files: {
        "a.ts": { path: "a.ts", exists: true, dependencies: ["b.ts"], dependents: [] },
        "b.ts": { path: "b.ts", exists: true, dependencies: [], dependents: ["a.ts"] },
      },
    });
    const results = findOrphanFiles(graph);
    expect(results).toHaveLength(0);
  });
});
