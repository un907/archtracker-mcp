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
  formatAnalysisReport,
} from "../analyzer/index.js";
import {
  saveSnapshot,
  loadSnapshot,
  computeDiff,
  formatDiffReport,
  StorageError,
} from "../storage/index.js";
import type { ArchContext } from "../types/schema.js";
import { validatePath, PathTraversalError } from "../utils/path-guard.js";
import { t } from "../i18n/index.js";
import { VERSION } from "../utils/version.js";
import { LANGUAGE_IDS } from "../analyzer/engines/types.js";

const server = new McpServer({
  name: "archtracker",
  version: VERSION,
});

/** Zod enum for language parameter — derived from LANGUAGE_IDS */
const languageEnum = z.enum(LANGUAGE_IDS);

/** Human-readable language list for tool descriptions */
const LANG_DISPLAY: Record<string, string> = {
  javascript: "JS/TS", "c-cpp": "C/C++", "c-sharp": "C#",
};
const languageList = LANGUAGE_IDS
  .map((id) => LANG_DISPLAY[id] ?? id.charAt(0).toUpperCase() + id.slice(1))
  .join(", ");

// ─── Tool 1: generate_map ───────────────────────────────────────

server.tool(
  "generate_map",
  `Analyze dependency graph of a directory and return file import/export structure as JSON. Supports ${languageList}.`,
  {
    targetDir: z
      .string()
      .default("src")
      .describe("Target directory path (default: src)"),
    exclude: z
      .array(z.string())
      .optional()
      .describe("Array of regex patterns to exclude (e.g. ['test', 'mock'])"),
    maxDepth: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Max analysis depth (0 = unlimited)"),
    language: languageEnum
      .optional()
      .describe("Target language (auto-detected if omitted)"),
  },
  async ({ targetDir, exclude, maxDepth, language }) => {
    try {
      validatePath(targetDir);
      const graph = await analyzeProject(targetDir, { exclude, maxDepth, language });

      const summary = [
        t("mcp.analyzeComplete", { files: graph.totalFiles, edges: graph.totalEdges }),
        graph.circularDependencies.length > 0
          ? t("mcp.circularFound", { count: graph.circularDependencies.length })
          : t("mcp.circularNone"),
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

// ─── Tool 2: analyze_existing_architecture ──────────────────────

server.tool(
  "analyze_existing_architecture",
  `Comprehensive architecture analysis for existing projects. Shows critical components, circular dependencies, orphan files, coupling hotspots, and directory breakdown. Supports ${LANGUAGE_IDS.length} languages.`,
  {
    targetDir: z
      .string()
      .default("src")
      .describe("Target directory path (default: src)"),
    exclude: z
      .array(z.string())
      .optional()
      .describe("Array of regex patterns to exclude"),
    topN: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Number of top items to show in each section (default: 10)"),
    saveSnapshot: z
      .boolean()
      .optional()
      .describe("Also save a snapshot after analysis (default: false)"),
    projectRoot: z
      .string()
      .default(".")
      .describe("Project root (needed only when saveSnapshot is true)"),
    language: languageEnum
      .optional()
      .describe("Target language (auto-detected if omitted)"),
  },
  async ({ targetDir, exclude, topN, saveSnapshot: doSave, projectRoot, language }) => {
    try {
      validatePath(targetDir);
      const graph = await analyzeProject(targetDir, { exclude, language });
      const report = formatAnalysisReport(graph, { topN: topN ?? 10 });

      const content: { type: "text"; text: string }[] = [
        { type: "text" as const, text: report },
      ];

      if (doSave) {
        validatePath(projectRoot);
        await saveSnapshot(projectRoot, graph);
        content.push({ type: "text" as const, text: t("analyze.snapshotSaved") });
      }

      return { content };
    } catch (error) {
      return errorResponse(error);
    }
  },
);

// ─── Tool 3: save_architecture_snapshot ─────────────────────────

server.tool(
  "save_architecture_snapshot",
  "Save the current dependency graph as a snapshot to .archtracker/snapshot.json",
  {
    targetDir: z
      .string()
      .default("src")
      .describe("Target directory path"),
    projectRoot: z
      .string()
      .default(".")
      .describe("Project root (where .archtracker is placed)"),
    language: languageEnum
      .optional()
      .describe("Target language (auto-detected if omitted)"),
  },
  async ({ targetDir, projectRoot, language }) => {
    try {
      validatePath(targetDir);
      validatePath(projectRoot);
      const graph = await analyzeProject(targetDir, { language });
      const snapshot = await saveSnapshot(projectRoot, graph);

      // Top 5 most-depended-on files
      const keyComponents = Object.values(graph.files)
        .sort((a, b) => b.dependents.length - a.dependents.length)
        .slice(0, 5)
        .map((f) => `  ${t("cli.dependedBy", { path: f.path, count: f.dependents.length })}`);

      const report = [
        t("mcp.snapshotSaved"),
        t("cli.timestamp", { ts: snapshot.timestamp }),
        t("cli.fileCount", { count: graph.totalFiles }),
        t("cli.edgeCount", { count: graph.totalEdges }),
        "",
        t("cli.keyComponents"),
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
  "Compare saved snapshot with current code dependencies and warn about files that may need updates",
  {
    targetDir: z
      .string()
      .default("src")
      .describe("Target directory path"),
    projectRoot: z
      .string()
      .default(".")
      .describe("Project root (where .archtracker is placed)"),
    language: languageEnum
      .optional()
      .describe("Target language (auto-detected if omitted)"),
  },
  async ({ targetDir, projectRoot, language }) => {
    try {
      validatePath(targetDir);
      validatePath(projectRoot);
      const existingSnapshot = await loadSnapshot(projectRoot);

      if (!existingSnapshot) {
        // Auto-generate initial snapshot
        const graph = await analyzeProject(targetDir, { language });
        await saveSnapshot(projectRoot, graph);
        return {
          content: [
            {
              type: "text" as const,
              text: [
                t("mcp.autoInit"),
                t("cli.fileCount", { count: graph.totalFiles }) + ", " + t("cli.edgeCount", { count: graph.totalEdges }),
                t("mcp.nextCheckEnabled"),
              ].join("\n"),
            },
          ],
        };
      }

      const currentGraph = await analyzeProject(targetDir, { language });
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
  "Get current valid file paths and architecture summary for AI session initialization",
  {
    targetDir: z
      .string()
      .default("src")
      .describe("Target directory path"),
    projectRoot: z
      .string()
      .default(".")
      .describe("Project root"),
    language: languageEnum
      .optional()
      .describe("Target language (auto-detected if omitted)"),
  },
  async ({ targetDir, projectRoot, language }) => {
    try {
      let snapshot = await loadSnapshot(projectRoot);

      // Auto-generate if no snapshot exists
      if (!snapshot) {
        const graph = await analyzeProject(targetDir, { language });
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
        t("cli.project", { path: graph.rootDir }),
        t("cli.fileCount", { count: graph.totalFiles }),
        t("cli.edgeCount", { count: graph.totalEdges }),
        t("cli.circularCount", { count: graph.circularDependencies.length }),
        t("cli.snapshot", { ts: snapshot.timestamp }),
        "",
        t("cli.keyComponents"),
        ...keyComponents.map(
          (c) =>
            `  ${t("cli.dependedBy", { path: c.path, count: c.dependentCount })}`,
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
  "Search architecture: file path search, impact analysis, critical component detection, orphan file detection",
  {
    query: z
      .string()
      .optional()
      .describe("Search query (required for path/affected modes, not needed for critical/orphans)"),
    mode: z
      .enum(["path", "affected", "critical", "orphans"])
      .default("path")
      .describe(
        "Search mode: path=search by path, affected=change impact, critical=key files, orphans=isolated files",
      ),
    targetDir: z
      .string()
      .default("src")
      .describe("Target directory path"),
    projectRoot: z
      .string()
      .default(".")
      .describe("Project root"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Max results (default: 10)"),
    language: languageEnum
      .optional()
      .describe("Target language (auto-detected if omitted)"),
  },
  async ({ query, mode, targetDir, projectRoot, limit, language }) => {
    try {
      validatePath(targetDir);
      validatePath(projectRoot);
      // Use existing snapshot or generate fresh
      let snapshot = await loadSnapshot(projectRoot);
      if (!snapshot) {
        const graph = await analyzeProject(targetDir, { language });
        snapshot = await saveSnapshot(projectRoot, graph);
      }

      const graph = snapshot.graph;
      const maxResults = limit ?? 10;
      let results;

      // Validate query is provided for modes that require it
      if ((mode === "path" || mode === "affected") && !query) {
        return {
          content: [{ type: "text" as const, text: t("mcp.queryRequired", { mode }) }],
          isError: true,
        };
      }

      switch (mode) {
        case "path":
          results = searchByPath(graph, query!);
          break;
        case "affected":
          results = findAffectedFiles(graph, query!);
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
            { type: "text" as const, text: t("search.noResults", { query: query ?? "", mode }) },
          ],
        };
      }

      const lines = [
        t("search.results", { count: results.length, mode }),
        "",
        ...results.slice(0, maxResults).map((r) => {
          return [
            `  ${r.file}`,
            `   ${r.matchReason}`,
            `   deps: ${r.dependencyCount} -> [${r.dependencies.slice(0, 5).join(", ")}${r.dependencies.length > 5 ? "..." : ""}]`,
            `   dependents: ${r.dependentCount} <- [${r.dependents.slice(0, 5).join(", ")}${r.dependents.length > 5 ? "..." : ""}]`,
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

  if (error instanceof PathTraversalError) {
    message = t("error.pathTraversal", { message: error.message });
  } else if (error instanceof AnalyzerError) {
    message = t("error.analyzer", { message: error.message });
  } else if (error instanceof StorageError) {
    message = t("error.storage", { message: error.message });
  } else if (error instanceof Error) {
    message = t("error.generic", { message: error.message });
  } else {
    message = t("error.unexpected", { message: String(error) });
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
