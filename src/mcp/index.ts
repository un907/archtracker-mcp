import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  analyzeProject,
  AnalyzerError,
  searchByPath,
  findAffectedFiles,
  findCriticalFiles,
  findOrphanFiles,
} from "../analyzer/index.js";
import {
  saveSnapshot,
  loadSnapshot,
  computeDiff,
  formatDiffReport,
  StorageError,
} from "../storage/index.js";
import type { ArchContext } from "../types/schema.js";

const server = new McpServer({
  name: "archtracker",
  version: "0.1.0",
});

// ─── Tool 1: generate_map ───────────────────────────────────────

server.tool(
  "generate_map",
  "指定ディレクトリの依存関係グラフを解析し、ファイル間のimport/export構造をJSON形式で返す",
  {
    targetDir: z
      .string()
      .default("src")
      .describe("解析対象のディレクトリパス（デフォルト: src）"),
    exclude: z
      .array(z.string())
      .optional()
      .describe("除外する正規表現パターンの配列（例: ['test', 'mock']）"),
    maxDepth: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("解析の最大深度（0 = 無制限）"),
  },
  async ({ targetDir, exclude, maxDepth }) => {
    try {
      const graph = await analyzeProject(targetDir, { exclude, maxDepth });

      const summary = [
        `解析完了: ${graph.totalFiles}ファイル, ${graph.totalEdges}エッジ`,
        graph.circularDependencies.length > 0
          ? `⚠ 循環参照: ${graph.circularDependencies.length}件検出`
          : "循環参照: なし",
      ].join("\n");

      return {
        content: [
          { type: "text" as const, text: summary },
          { type: "text" as const, text: JSON.stringify(graph, null, 2) },
        ],
      };
    } catch (error) {
      return errorResponse(error);
    }
  },
);

// ─── Tool 2: save_architecture_snapshot ─────────────────────────

server.tool(
  "save_architecture_snapshot",
  "現在の依存関係グラフをスナップショットとして .archtracker/snapshot.json に保存する",
  {
    targetDir: z
      .string()
      .default("src")
      .describe("解析対象のディレクトリパス"),
    projectRoot: z
      .string()
      .default(".")
      .describe("プロジェクトルート（.archtrackerの配置先）"),
  },
  async ({ targetDir, projectRoot }) => {
    try {
      const graph = await analyzeProject(targetDir);
      const snapshot = await saveSnapshot(projectRoot, graph);

      // Top 5 most-depended-on files
      const keyComponents = Object.values(graph.files)
        .sort((a, b) => b.dependents.length - a.dependents.length)
        .slice(0, 5)
        .map((f) => `  ${f.path} (${f.dependents.length}件が依存)`);

      const report = [
        "✅ スナップショットを保存しました",
        `  タイムスタンプ: ${snapshot.timestamp}`,
        `  ファイル数: ${graph.totalFiles}`,
        `  エッジ数: ${graph.totalEdges}`,
        "",
        "主要コンポーネント（被依存数トップ5）:",
        ...keyComponents,
      ].join("\n");

      return { content: [{ type: "text" as const, text: report }] };
    } catch (error) {
      return errorResponse(error);
    }
  },
);

// ─── Tool 3: check_architecture_diff ────────────────────────────

server.tool(
  "check_architecture_diff",
  "保存済みスナップショットと現在のコードの依存関係を比較し、修正が必要な可能性のあるファイルを警告する",
  {
    targetDir: z
      .string()
      .default("src")
      .describe("解析対象のディレクトリパス"),
    projectRoot: z
      .string()
      .default(".")
      .describe("プロジェクトルート（.archtrackerの配置先）"),
  },
  async ({ targetDir, projectRoot }) => {
    try {
      const existingSnapshot = await loadSnapshot(projectRoot);

      if (!existingSnapshot) {
        // Auto-generate initial snapshot
        const graph = await analyzeProject(targetDir);
        await saveSnapshot(projectRoot, graph);
        return {
          content: [
            {
              type: "text" as const,
              text: [
                "スナップショットが存在しなかったため、初期スナップショットを自動生成しました。",
                `ファイル数: ${graph.totalFiles}, エッジ数: ${graph.totalEdges}`,
                "次回の実行時から差分チェックが有効になります。",
              ].join("\n"),
            },
          ],
        };
      }

      const currentGraph = await analyzeProject(targetDir);
      const diff = computeDiff(existingSnapshot.graph, currentGraph);
      const report = formatDiffReport(diff);

      return { content: [{ type: "text" as const, text: report }] };
    } catch (error) {
      return errorResponse(error);
    }
  },
);

// ─── Tool 4: get_current_context ────────────────────────────────

server.tool(
  "get_current_context",
  "AIセッション開始時に実行。最新の有効なファイルパス一覧とアーキテクチャサマリーを返し、古いパスの参照を防止する",
  {
    targetDir: z
      .string()
      .default("src")
      .describe("解析対象のディレクトリパス"),
    projectRoot: z
      .string()
      .default(".")
      .describe("プロジェクトルート"),
  },
  async ({ targetDir, projectRoot }) => {
    try {
      let snapshot = await loadSnapshot(projectRoot);

      // Auto-generate if no snapshot exists
      if (!snapshot) {
        const graph = await analyzeProject(targetDir);
        snapshot = await saveSnapshot(projectRoot, graph);
      }

      const graph = snapshot.graph;

      // Build key components list (sorted by dependent count)
      const keyComponents = Object.values(graph.files)
        .filter((f) => f.dependents.length > 0 || f.dependencies.length > 0)
        .sort((a, b) => b.dependents.length - a.dependents.length)
        .slice(0, 20)
        .map((f) => ({
          path: f.path,
          dependentCount: f.dependents.length,
          dependencyCount: f.dependencies.length,
        }));

      const validPaths = Object.keys(graph.files).sort();

      const summary = [
        `プロジェクト: ${graph.rootDir}`,
        `総ファイル数: ${graph.totalFiles}`,
        `総エッジ数: ${graph.totalEdges}`,
        `循環参照: ${graph.circularDependencies.length}件`,
        `スナップショット: ${snapshot.timestamp}`,
        "",
        "主要コンポーネント:",
        ...keyComponents.map(
          (c) =>
            `  ${c.path} (依存: ${c.dependencyCount}, 被依存: ${c.dependentCount})`,
        ),
      ].join("\n");

      const context: ArchContext = {
        validPaths,
        summary,
        snapshotExists: true,
        snapshotTimestamp: snapshot.timestamp,
        keyComponents,
      };

      return {
        content: [
          { type: "text" as const, text: summary },
          {
            type: "text" as const,
            text: JSON.stringify(context, null, 2),
          },
        ],
      };
    } catch (error) {
      return errorResponse(error);
    }
  },
);

// ─── Tool 5: search_architecture ────────────────────────────────

server.tool(
  "search_architecture",
  "アーキテクチャを検索する。ファイルパス検索、影響範囲分析、重要コンポーネント特定、孤立ファイル検出が可能",
  {
    query: z
      .string()
      .describe("検索クエリ（ファイルパスのパターン）"),
    mode: z
      .enum(["path", "affected", "critical", "orphans"])
      .default("path")
      .describe(
        "検索モード: path=パスで検索, affected=変更影響範囲, critical=重要ファイル, orphans=孤立ファイル",
      ),
    targetDir: z
      .string()
      .default("src")
      .describe("解析対象のディレクトリパス"),
    projectRoot: z
      .string()
      .default(".")
      .describe("プロジェクトルート"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("結果の最大件数（デフォルト: 10）"),
  },
  async ({ query, mode, targetDir, projectRoot, limit }) => {
    try {
      // Use existing snapshot or generate fresh
      let snapshot = await loadSnapshot(projectRoot);
      if (!snapshot) {
        const graph = await analyzeProject(targetDir);
        snapshot = await saveSnapshot(projectRoot, graph);
      }

      const graph = snapshot.graph;
      const maxResults = limit ?? 10;
      let results;

      switch (mode) {
        case "path":
          results = searchByPath(graph, query);
          break;
        case "affected":
          results = findAffectedFiles(graph, query);
          break;
        case "critical":
          results = findCriticalFiles(graph, maxResults);
          break;
        case "orphans":
          results = findOrphanFiles(graph);
          break;
      }

      if (results.length === 0) {
        return {
          content: [
            { type: "text" as const, text: `検索結果なし: "${query}" (モード: ${mode})` },
          ],
        };
      }

      const lines = [
        `検索結果: ${results.length}件 (モード: ${mode})`,
        "",
        ...results.slice(0, maxResults).map((r) => {
          return [
            `📄 ${r.file}`,
            `   理由: ${r.matchReason}`,
            `   依存: ${r.dependencyCount}件 → [${r.dependencies.slice(0, 5).join(", ")}${r.dependencies.length > 5 ? "..." : ""}]`,
            `   被依存: ${r.dependentCount}件 ← [${r.dependents.slice(0, 5).join(", ")}${r.dependents.length > 5 ? "..." : ""}]`,
          ].join("\n");
        }),
      ];

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (error) {
      return errorResponse(error);
    }
  },
);

// ─── Error handling helper ──────────────────────────────────────

function errorResponse(error: unknown) {
  let message: string;

  if (error instanceof AnalyzerError) {
    message = `[解析エラー] ${error.message}`;
  } else if (error instanceof StorageError) {
    message = `[ストレージエラー] ${error.message}`;
  } else if (error instanceof Error) {
    message = `[エラー] ${error.message}`;
  } else {
    message = `[エラー] 予期しないエラーが発生しました: ${String(error)}`;
  }

  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

// ─── Server startup ─────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[archtracker] MCP server running on stdio");
}

main().catch((error) => {
  console.error("[archtracker] Fatal error:", error);
  process.exit(1);
});
