/**
 * Storage robustness tests — スナップショット破損・不正入力に対する耐性
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { saveSnapshot, loadSnapshot, StorageError } from "./snapshot.js";
import type { DependencyGraph } from "../types/schema.js";
import { setLocale } from "../i18n/index.js";

setLocale("en");

function makeGraph(overrides: Partial<DependencyGraph> = {}): DependencyGraph {
  return {
    rootDir: "/test",
    files: {
      "index.ts": {
        path: "index.ts",
        exists: true,
        dependencies: ["utils.ts"],
        dependents: [],
      },
      "utils.ts": {
        path: "utils.ts",
        exists: true,
        dependencies: [],
        dependents: ["index.ts"],
      },
    },
    edges: [
      { source: "index.ts", target: "utils.ts", type: "static" },
    ],
    circularDependencies: [],
    totalFiles: 2,
    totalEdges: 1,
    ...overrides,
  };
}

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "archtracker-storage-robust-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════
// 1. 破損した snapshot.json
// ═══════════════════════════════════════════════════════

describe("corrupted snapshot file", () => {
  it("throws StorageError for invalid JSON", async () => {
    await mkdir(join(tempDir, ".archtracker"), { recursive: true });
    await writeFile(
      join(tempDir, ".archtracker", "snapshot.json"),
      "{ this is not valid json !!!",
    );

    await expect(loadSnapshot(tempDir)).rejects.toThrow(StorageError);
  });

  it("throws StorageError for empty file", async () => {
    await mkdir(join(tempDir, ".archtracker"), { recursive: true });
    await writeFile(
      join(tempDir, ".archtracker", "snapshot.json"),
      "",
    );

    await expect(loadSnapshot(tempDir)).rejects.toThrow(StorageError);
  });

  it("throws StorageError for valid JSON with wrong schema", async () => {
    await mkdir(join(tempDir, ".archtracker"), { recursive: true });
    await writeFile(
      join(tempDir, ".archtracker", "snapshot.json"),
      JSON.stringify({ version: "99.99", invalid: true }),
    );

    await expect(loadSnapshot(tempDir)).rejects.toThrow(StorageError);
  });

  it("throws StorageError for valid JSON with missing fields", async () => {
    await mkdir(join(tempDir, ".archtracker"), { recursive: true });
    await writeFile(
      join(tempDir, ".archtracker", "snapshot.json"),
      JSON.stringify({
        version: "1.0",
        timestamp: "2026-01-01T00:00:00.000Z",
        // missing rootDir and graph
      }),
    );

    await expect(loadSnapshot(tempDir)).rejects.toThrow(StorageError);
  });
});

// ═══════════════════════════════════════════════════════
// 2. 保存 → 読込 の整合性
// ═══════════════════════════════════════════════════════

describe("save/load round-trip integrity", () => {
  it("preserves all graph data through round-trip", async () => {
    const graph = makeGraph();
    await saveSnapshot(tempDir, graph);
    const loaded = await loadSnapshot(tempDir);

    expect(loaded).not.toBeNull();
    expect(loaded!.graph.totalFiles).toBe(graph.totalFiles);
    expect(loaded!.graph.totalEdges).toBe(graph.totalEdges);
    expect(loaded!.graph.files["index.ts"].dependencies).toEqual(["utils.ts"]);
    expect(loaded!.graph.files["utils.ts"].dependents).toEqual(["index.ts"]);
    expect(loaded!.graph.edges).toEqual(graph.edges);
  });

  it("preserves circular dependencies through round-trip", async () => {
    const graph = makeGraph({
      circularDependencies: [{ cycle: ["a.ts", "b.ts", "a.ts"] }],
    });
    await saveSnapshot(tempDir, graph);
    const loaded = await loadSnapshot(tempDir);

    expect(loaded!.graph.circularDependencies).toEqual([
      { cycle: ["a.ts", "b.ts", "a.ts"] },
    ]);
  });

  it("overwrites previous snapshot", async () => {
    const graph1 = makeGraph({ totalFiles: 2 });
    await saveSnapshot(tempDir, graph1);

    const graph2 = makeGraph({
      totalFiles: 5,
      files: {
        ...makeGraph().files,
        "a.ts": { path: "a.ts", exists: true, dependencies: [], dependents: [] },
        "b.ts": { path: "b.ts", exists: true, dependencies: [], dependents: [] },
        "c.ts": { path: "c.ts", exists: true, dependencies: [], dependents: [] },
      },
    });
    await saveSnapshot(tempDir, graph2);

    const loaded = await loadSnapshot(tempDir);
    expect(loaded!.graph.totalFiles).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════
// 3. .archtracker ディレクトリが無い場合
// ═══════════════════════════════════════════════════════

describe("missing .archtracker directory", () => {
  it("loadSnapshot returns null (not error)", async () => {
    const result = await loadSnapshot(tempDir);
    expect(result).toBeNull();
  });

  it("saveSnapshot creates directory automatically", async () => {
    const graph = makeGraph();
    await saveSnapshot(tempDir, graph);
    const loaded = await loadSnapshot(tempDir);
    expect(loaded).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════
// 4. 大量のファイルを含むグラフの保存
// ═══════════════════════════════════════════════════════

describe("large graph handling", () => {
  it("handles graph with 1000 files", async () => {
    const files: DependencyGraph["files"] = {};
    for (let i = 0; i < 1000; i++) {
      files[`file${i}.ts`] = {
        path: `file${i}.ts`,
        exists: true,
        dependencies: i > 0 ? [`file${i - 1}.ts`] : [],
        dependents: i < 999 ? [`file${i + 1}.ts`] : [],
      };
    }
    const graph = makeGraph({ files, totalFiles: 1000 });
    await saveSnapshot(tempDir, graph);
    const loaded = await loadSnapshot(tempDir);

    expect(loaded!.graph.totalFiles).toBe(1000);
    expect(Object.keys(loaded!.graph.files).length).toBe(1000);
  });
});

// ═══════════════════════════════════════════════════════
// 5. snapshot.json にUnicode / 特殊文字が含まれる場合
// ═══════════════════════════════════════════════════════

describe("special characters in graph data", () => {
  it("handles unicode file paths", async () => {
    const graph = makeGraph({
      files: {
        "日本語ファイル.ts": {
          path: "日本語ファイル.ts",
          exists: true,
          dependencies: [],
          dependents: [],
        },
      },
      totalFiles: 1,
    });
    await saveSnapshot(tempDir, graph);
    const loaded = await loadSnapshot(tempDir);
    expect(loaded!.graph.files["日本語ファイル.ts"]).toBeDefined();
  });

  it("handles file paths with special characters", async () => {
    const graph = makeGraph({
      files: {
        "file with spaces.ts": {
          path: "file with spaces.ts",
          exists: true,
          dependencies: [],
          dependents: [],
        },
        "file-with-dashes.ts": {
          path: "file-with-dashes.ts",
          exists: true,
          dependencies: [],
          dependents: [],
        },
      },
      totalFiles: 2,
    });
    await saveSnapshot(tempDir, graph);
    const loaded = await loadSnapshot(tempDir);
    expect(loaded!.graph.files["file with spaces.ts"]).toBeDefined();
    expect(loaded!.graph.files["file-with-dashes.ts"]).toBeDefined();
  });
});
