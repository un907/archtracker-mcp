import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { saveSnapshot, loadSnapshot, hasArchtrackerDir, StorageError } from "./snapshot.js";
import { computeDiff, formatDiffReport } from "./diff.js";
import type { DependencyGraph, ArchSnapshot } from "../types/schema.js";
import { SCHEMA_VERSION } from "../types/schema.js";
import { setLocale } from "../i18n/index.js";

// Use English locale for predictable test assertions
setLocale("en");

// Helper to create a minimal DependencyGraph
function makeGraph(overrides: Partial<DependencyGraph> = {}): DependencyGraph {
  return {
    rootDir: "/test",
    files: {
      "index.ts": {
        path: "index.ts",
        exists: true,
        dependencies: ["utils/a.ts", "utils/b.ts"],
        dependents: [],
      },
      "utils/a.ts": {
        path: "utils/a.ts",
        exists: true,
        dependencies: [],
        dependents: ["index.ts"],
      },
      "utils/b.ts": {
        path: "utils/b.ts",
        exists: true,
        dependencies: ["utils/a.ts"],
        dependents: ["index.ts"],
      },
    },
    edges: [
      { source: "index.ts", target: "utils/a.ts", type: "static" },
      { source: "index.ts", target: "utils/b.ts", type: "static" },
      { source: "utils/b.ts", target: "utils/a.ts", type: "static" },
    ],
    circularDependencies: [],
    totalFiles: 3,
    totalEdges: 3,
    ...overrides,
  };
}

describe("Snapshot", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "archtracker-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should save and load a snapshot", async () => {
    const graph = makeGraph();
    const saved = await saveSnapshot(tempDir, graph);

    expect(saved.version).toBe(SCHEMA_VERSION);
    expect(saved.timestamp).toBeTruthy();
    expect(saved.graph).toEqual(graph);

    const loaded = await loadSnapshot(tempDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(SCHEMA_VERSION);
    expect(loaded!.graph.totalFiles).toBe(3);
  });

  it("should create .archtracker directory", async () => {
    const graph = makeGraph();
    await saveSnapshot(tempDir, graph);

    const exists = await hasArchtrackerDir(tempDir);
    expect(exists).toBe(true);
  });

  it("should return null when no snapshot exists", async () => {
    const result = await loadSnapshot(tempDir);
    expect(result).toBeNull();
  });

  it("should persist snapshot as valid JSON", async () => {
    const graph = makeGraph();
    await saveSnapshot(tempDir, graph);

    const raw = await readFile(
      join(tempDir, ".archtracker", "snapshot.json"),
      "utf-8",
    );
    const parsed = JSON.parse(raw) as ArchSnapshot;
    expect(parsed.version).toBe("1.0");
  });
});

describe("computeDiff", () => {
  it("should detect no changes when graphs are identical", () => {
    const graph = makeGraph();
    const diff = computeDiff(graph, graph);

    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.modified).toEqual([]);
    expect(diff.affectedDependents).toEqual([]);
  });

  it("should detect added files", () => {
    const oldGraph = makeGraph();
    const newGraph = makeGraph({
      files: {
        ...oldGraph.files,
        "utils/c.ts": {
          path: "utils/c.ts",
          exists: true,
          dependencies: [],
          dependents: [],
        },
      },
      totalFiles: 4,
    });

    const diff = computeDiff(oldGraph, newGraph);
    expect(diff.added).toContain("utils/c.ts");
    expect(diff.removed).toEqual([]);
  });

  it("should detect removed files and their affected dependents", () => {
    const oldGraph = makeGraph();

    // Remove utils/a.ts from the new graph
    const { "utils/a.ts": _removed, ...remainingFiles } = oldGraph.files;
    const newGraph = makeGraph({
      files: {
        ...remainingFiles,
        // Update index.ts dependencies to not include utils/a.ts
        "index.ts": {
          ...oldGraph.files["index.ts"],
          dependencies: ["utils/b.ts"],
        },
      },
      totalFiles: 2,
    });

    const diff = computeDiff(oldGraph, newGraph);
    expect(diff.removed).toContain("utils/a.ts");

    // index.ts and utils/b.ts depended on utils/a.ts
    const affectedFiles = diff.affectedDependents.map((a) => a.file);
    expect(affectedFiles).toContain("index.ts");
  });

  it("should detect modified dependencies", () => {
    const oldGraph = makeGraph();
    const newGraph = makeGraph({
      files: {
        ...oldGraph.files,
        "index.ts": {
          ...oldGraph.files["index.ts"],
          dependencies: ["utils/a.ts"], // removed utils/b.ts dependency
        },
      },
    });

    const diff = computeDiff(oldGraph, newGraph);
    expect(diff.modified).toContain("index.ts");
  });
});

describe("formatDiffReport", () => {
  it("should report no changes", () => {
    const report = formatDiffReport({
      added: [],
      removed: [],
      modified: [],
      affectedDependents: [],
    });
    expect(report).toContain("No changes");
  });

  it("should format a complete report", () => {
    const report = formatDiffReport({
      added: ["new-file.ts"],
      removed: ["old-file.ts"],
      modified: ["changed.ts"],
      affectedDependents: [
        {
          file: "consumer.ts",
          reason: '依存先 "old-file.ts" が削除されました',
          dependsOn: "old-file.ts",
        },
      ],
    });

    expect(report).toContain("Added Files");
    expect(report).toContain("new-file.ts");
    expect(report).toContain("Removed Files");
    expect(report).toContain("old-file.ts");
    expect(report).toContain("Modified Dependencies");
    expect(report).toContain("Files Requiring Review");
    expect(report).toContain("consumer.ts");
  });
});
