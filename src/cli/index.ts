import { Command } from "commander";
import { watch } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { analyzeProject, analyzeMultiLayer, detectCrossLayerConnections, AnalyzerError, formatAnalysisReport } from "../analyzer/index.js";
import {
  saveSnapshot,
  loadSnapshot,
  computeDiff,
  formatDiffReport,
  StorageError,
} from "../storage/index.js";
import { loadLayerConfig, saveLayerConfig } from "../storage/layers.js";
import { startViewer } from "../web/server.js";
import { t, setLocale } from "../i18n/index.js";
import type { Locale } from "../i18n/index.js";
import { VERSION } from "../utils/version.js";
import { LANGUAGE_IDS } from "../analyzer/engines/types.js";
import type { LanguageId } from "../analyzer/engines/types.js";
import type { DependencyGraph, MultiLayerGraph, LayerMetadata } from "../types/schema.js";
import type { CrossLayerConnection } from "../types/layers.js";

const VALID_LANGUAGES = LANGUAGE_IDS as readonly string[];

/**
 * Resolve graph: if layers.json exists and --target was not explicitly set,
 * use multi-layer analysis. Otherwise, use single-dir analysis.
 */
async function resolveGraph(opts: {
  target: string;
  root: string;
  exclude?: string[];
  language?: LanguageId;
}): Promise<{ graph: DependencyGraph; multiLayer?: MultiLayerGraph; layerMetadata?: LayerMetadata[]; crossLayerEdges?: CrossLayerConnection[] }> {
  // Check if --target was explicitly provided (not the default "src")
  const targetExplicit = process.argv.some((a) => a === "-t" || a === "--target");

  if (!targetExplicit) {
    const layerConfig = await loadLayerConfig(opts.root);
    if (layerConfig) {
      const multi = await analyzeMultiLayer(opts.root, layerConfig.layers);
      // Merge manual connections from layers.json with auto-detected ones
      const autoConnections = detectCrossLayerConnections(multi.layers, layerConfig.layers);
      const manualConnections = layerConfig.connections ?? [];
      // Manual connections take priority; deduplicate by fromLayer/fromFile→toLayer/toFile
      const manualKeys = new Set(manualConnections.map(
        (c) => `${c.fromLayer}/${c.fromFile}→${c.toLayer}/${c.toFile}`,
      ));
      const merged = [
        ...manualConnections,
        ...autoConnections.filter(
          (c) => !manualKeys.has(`${c.fromLayer}/${c.fromFile}→${c.toLayer}/${c.toFile}`),
        ),
      ];
      return {
        graph: multi.merged,
        multiLayer: multi,
        layerMetadata: multi.layerMetadata,
        crossLayerEdges: merged,
      };
    }
  }

  const graph = await analyzeProject(opts.target, {
    exclude: opts.exclude,
    language: opts.language,
  });
  return { graph };
}

const program = new Command();

program
  .name("archtracker")
  .description(
    "Architecture & Dependency Tracker — Prevent missed architecture changes in AI-driven development",
  )
  .version(VERSION)
  .option("--lang <locale>", "Language (en/ja, auto-detected from LANG env)")
  .hook("preAction", (thisCommand) => {
    const lang = thisCommand.opts().lang;
    if (lang === "en" || lang === "ja") {
      setLocale(lang as Locale);
    }
  });

// ─── archtracker init ───────────────────────────────────────────

program
  .command("init")
  .description("Generate initial snapshot and save to .archtracker/")
  .option("-t, --target <dir>", "Target directory", "src")
  .option("-r, --root <dir>", "Project root", ".")
  .option(
    "-e, --exclude <patterns...>",
    "Exclude patterns (regex)",
  )
  .option("-l, --language <lang>", `Target language (${LANGUAGE_IDS.join(", ")})`)
  .action(async (opts) => {
    try {
      const language = validateLanguage(opts.language);
      console.log(t("cli.analyzing"));
      const { graph, multiLayer } = await resolveGraph({
        target: opts.target,
        root: opts.root,
        exclude: opts.exclude,
        language,
      });

      const snapshot = await saveSnapshot(opts.root, graph, multiLayer);

      console.log(t("cli.snapshotSaved"));
      console.log(t("cli.timestamp", { ts: snapshot.timestamp }));
      console.log(t("cli.fileCount", { count: graph.totalFiles }));
      console.log(t("cli.edgeCount", { count: graph.totalEdges }));

      if (graph.circularDependencies.length > 0) {
        console.log(
          t("cli.circularCount", { count: graph.circularDependencies.length }),
        );
      }

      // Show top 5 key components
      const top = Object.values(graph.files)
        .sort((a, b) => b.dependents.length - a.dependents.length)
        .slice(0, 5);

      if (top.length > 0 && top[0].dependents.length > 0) {
        console.log(t("cli.keyComponents"));
        for (const f of top) {
          if (f.dependents.length === 0) break;
          console.log(`  ${t("cli.dependedBy", { path: f.path, count: f.dependents.length })}`);
        }
      }
    } catch (error) {
      handleError(error);
    }
  });

// ─── archtracker analyze ─────────────────────────────────────

program
  .command("analyze")
  .description(
    "Comprehensive architecture analysis for existing projects",
  )
  .option("-t, --target <dir>", "Target directory", "src")
  .option("-r, --root <dir>", "Project root", ".")
  .option(
    "-e, --exclude <patterns...>",
    "Exclude patterns (regex)",
  )
  .option("-n, --top <number>", "Number of top components to show", "10")
  .option("--save", "Also save a snapshot after analysis")
  .option("-l, --language <lang>", `Target language (${LANGUAGE_IDS.join(", ")})`)
  .action(async (opts) => {
    try {
      const language = validateLanguage(opts.language);
      console.log(t("cli.analyzing"));
      const { graph, multiLayer } = await resolveGraph({
        target: opts.target,
        root: opts.root,
        exclude: opts.exclude,
        language,
      });

      const report = formatAnalysisReport(graph, { topN: parseInt(opts.top, 10) });
      console.log(report);

      if (opts.save) {
        await saveSnapshot(opts.root, graph, multiLayer);
        console.log(t("analyze.snapshotSaved"));
      }
    } catch (error) {
      handleError(error);
    }
  });

// ─── archtracker check ─────────────────────────────────────────

program
  .command("check")
  .description(
    "Compare snapshot with current code and report change impacts",
  )
  .option("-t, --target <dir>", "Target directory", "src")
  .option("-r, --root <dir>", "Project root", ".")
  .option("--ci", "CI mode: exit code 1 if affected files exist")
  .option("-l, --language <lang>", `Target language (${LANGUAGE_IDS.join(", ")})`)
  .action(async (opts) => {
    try {
      const language = validateLanguage(opts.language);
      const existingSnapshot = await loadSnapshot(opts.root);

      if (!existingSnapshot) {
        console.log(t("cli.noSnapshot"));
        process.exit(1);
      }

      console.log(t("cli.analyzing"));
      const { graph: currentGraph } = await resolveGraph({
        target: opts.target,
        root: opts.root,
        language,
      });
      const diff = computeDiff(existingSnapshot.graph, currentGraph);
      const report = formatDiffReport(diff);

      console.log(report);

      // CI mode: exit with error if there are affected dependents
      if (opts.ci && diff.affectedDependents.length > 0) {
        console.log(t("cli.ciFailed", { count: diff.affectedDependents.length }));
        process.exit(1);
      }
    } catch (error) {
      handleError(error);
    }
  });

// ─── archtracker context ────────────────────────────────────────

program
  .command("context")
  .description(
    "Display current architecture context (for AI session initialization)",
  )
  .option("-t, --target <dir>", "Target directory", "src")
  .option("-r, --root <dir>", "Project root", ".")
  .option("--json", "Output in JSON format")
  .option("-l, --language <lang>", `Target language (${LANGUAGE_IDS.join(", ")})`)
  .action(async (opts) => {
    try {
      const language = validateLanguage(opts.language);
      let snapshot = await loadSnapshot(opts.root);

      if (!snapshot) {
        console.log(t("cli.autoGenerating"));
        const result = await resolveGraph({
          target: opts.target,
          root: opts.root,
          language,
        });
        snapshot = await saveSnapshot(opts.root, result.graph, result.multiLayer);
      }

      const graph = snapshot.graph;

      if (opts.json) {
        const context = {
          validPaths: Object.keys(graph.files).sort(),
          snapshotTimestamp: snapshot.timestamp,
          totalFiles: graph.totalFiles,
          totalEdges: graph.totalEdges,
          circularDependencies: graph.circularDependencies.length,
          keyComponents: Object.values(graph.files)
            .sort((a, b) => b.dependents.length - a.dependents.length)
            .slice(0, 20)
            .map((f) => ({
              path: f.path,
              dependentCount: f.dependents.length,
              dependencyCount: f.dependencies.length,
            })),
        };
        console.log(JSON.stringify(context, null, 2));
        return;
      }

      console.log(t("cli.project", { path: graph.rootDir }));
      console.log(t("cli.fileCount", { count: graph.totalFiles }));
      console.log(t("cli.edgeCount", { count: graph.totalEdges }));
      console.log(t("cli.circularCount", { count: graph.circularDependencies.length }));
      console.log(t("cli.snapshot", { ts: snapshot.timestamp }));

      console.log(t("cli.validPaths"));
      for (const f of Object.keys(graph.files).sort()) {
        console.log(`  ${f}`);
      }
    } catch (error) {
      handleError(error);
    }
  });

// ─── archtracker serve ──────────────────────────────────────────

program
  .command("serve")
  .description(
    "Start interactive architecture graph viewer in browser",
  )
  .option("-t, --target <dir>", "Target directory", "src")
  .option("-r, --root <dir>", "Project root", ".")
  .option("-p, --port <number>", "Port number", "3000")
  .option(
    "-e, --exclude <patterns...>",
    "Exclude patterns (regex)",
  )
  .option("-w, --watch", "Watch for file changes and auto-reload")
  .option("-l, --language <lang>", `Target language (${LANGUAGE_IDS.join(", ")})`)
  .action(async (opts) => {
    try {
      const language = validateLanguage(opts.language);
      console.log(t("web.starting"));
      console.log(t("cli.analyzing"));

      // Use snapshot if available, otherwise analyze fresh
      let diff = null;
      const result = await resolveGraph({
        target: opts.target,
        root: opts.root,
        exclude: opts.exclude,
        language,
      });
      const snapshot = await loadSnapshot(opts.root);
      if (snapshot) {
        diff = computeDiff(snapshot.graph, result.graph);
      }

      const port = parseInt(opts.port, 10);
      const viewer = startViewer(result.graph, {
        port,
        diff,
        layerMetadata: result.layerMetadata,
        crossLayerEdges: result.crossLayerEdges,
      });

      console.log(t("web.listening", { port }));
      console.log(t("web.stop"));

      if (opts.watch) {
        console.log(t("web.watching", { dir: opts.target }));
        let debounce: ReturnType<typeof setTimeout> | null = null;
        watch(opts.target, { recursive: true }, () => {
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(async () => {
            try {
              console.log(t("web.reloading"));
              const newResult = await resolveGraph({
                target: opts.target,
                root: opts.root,
                exclude: opts.exclude,
                language,
              });
              viewer.close();
              startViewer(newResult.graph, {
                port,
                layerMetadata: newResult.layerMetadata,
                crossLayerEdges: newResult.crossLayerEdges,
              });
              console.log(t("web.reloaded"));
            } catch { /* ignore transient errors during file saves */ }
          }, 500);
        });
      }
    } catch (error) {
      handleError(error);
    }
  });

// ─── archtracker ci-setup ────────────────────────────────────────

program
  .command("ci-setup")
  .description(
    "Generate GitHub Actions workflow for architecture checks on PRs",
  )
  .option("-t, --target <dir>", "Target directory", "src")
  .action(async (opts) => {
    const workflow = `name: Architecture Check

on:
  pull_request:
    branches: [main, master]

jobs:
  arch-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx archtracker check --target ${opts.target} --ci
`;
    try {
      const dir = join(".github", "workflows");
      await mkdir(dir, { recursive: true });
      const path = join(dir, "arch-check.yml");
      await writeFile(path, workflow, "utf-8");
      console.log(t("ci.generated", { path }));
    } catch (error) {
      handleError(error);
    }
  });

// ─── archtracker layers ──────────────────────────────────────────

const layersCmd = program
  .command("layers")
  .description("Manage multi-layer architecture configuration");

layersCmd
  .command("init")
  .description("Create a template .archtracker/layers.json")
  .option("-r, --root <dir>", "Project root", ".")
  .action(async (opts) => {
    try {
      const existing = await loadLayerConfig(opts.root);
      if (existing) {
        console.log(t("layers.alreadyExists"));
        return;
      }

      const config = {
        version: "1.0" as const,
        layers: [
          { name: "Frontend", targetDir: "frontend", description: "UI layer" },
          { name: "Backend", targetDir: "backend", description: "API layer" },
        ],
      };

      await saveLayerConfig(opts.root, config);
      console.log(t("layers.created"));
    } catch (error) {
      handleError(error);
    }
  });

layersCmd
  .command("list")
  .description("List configured layers")
  .option("-r, --root <dir>", "Project root", ".")
  .action(async (opts) => {
    try {
      const config = await loadLayerConfig(opts.root);
      if (!config) {
        console.log(t("layers.notFound"));
        return;
      }

      console.log(t("layers.header", { count: config.layers.length }));
      for (const layer of config.layers) {
        const lang = layer.language ? ` [${layer.language}]` : "";
        const desc = layer.description ? ` — ${layer.description}` : "";
        console.log(`  ${layer.name}: ${layer.targetDir}${lang}${desc}`);
      }
    } catch (error) {
      handleError(error);
    }
  });

// ─── Error handling ─────────────────────────────────────────────

function validateLanguage(lang?: string): LanguageId | undefined {
  if (!lang) return undefined;
  if (VALID_LANGUAGES.includes(lang)) return lang as LanguageId;
  console.error(`Invalid language: ${lang}`);
  console.error(`Valid languages: ${LANGUAGE_IDS.join(", ")}`);
  process.exit(1);
}

function handleError(error: unknown): never {
  if (error instanceof AnalyzerError) {
    console.error(t("error.cli.analyzer", { message: error.message }));
  } else if (error instanceof StorageError) {
    console.error(t("error.cli.storage", { message: error.message }));
  } else if (error instanceof Error) {
    console.error(t("error.cli.generic", { message: error.message }));
  } else {
    console.error(t("error.cli.unexpected", { message: String(error) }));
  }
  process.exit(1);
}

program.parse();
