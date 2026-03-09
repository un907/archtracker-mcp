import { resolve, join } from "node:path";
import { readFileSync } from "node:fs";
import type {
  DependencyGraph,
  DependencyEdge,
  FileNode,
  LayerMetadata,
  MultiLayerGraph,
} from "../types/schema.js";
import type { LayerDefinition, CrossLayerConnection } from "../types/layers.js";
import { analyzeProject } from "./analyze.js";
import { detectLanguage } from "./engines/detect.js";

const LAYER_COLORS = [
  "#58a6ff",
  "#3fb950",
  "#d2a8ff",
  "#f0883e",
  "#79c0ff",
  "#56d4dd",
  "#db61a2",
  "#f778ba",
  "#ffa657",
  "#7ee787",
];

/**
 * Analyze multiple layers and produce a MultiLayerGraph.
 *
 * Each layer is analyzed independently via analyzeProject().
 * Results are merged into a unified graph with layer-prefixed node paths.
 */
export async function analyzeMultiLayer(
  projectRoot: string,
  layerDefs: LayerDefinition[],
): Promise<MultiLayerGraph> {
  const layers: Record<string, DependencyGraph> = {};
  const layerMetadata: LayerMetadata[] = [];

  for (let idx = 0; idx < layerDefs.length; idx++) {
    const def = layerDefs[idx];
    const targetDir = resolve(projectRoot, def.targetDir);

    const graph = await analyzeProject(targetDir, {
      exclude: def.exclude,
      language: def.language,
    });

    // Detect actual language used (may have been auto-detected)
    const language = def.language ?? (await detectLanguage(targetDir)) ?? "javascript";

    layers[def.name] = graph;

    layerMetadata.push({
      name: def.name,
      originalRootDir: graph.rootDir,
      language,
      color: def.color ?? LAYER_COLORS[idx % LAYER_COLORS.length],
      description: def.description,
      fileCount: graph.totalFiles,
      edgeCount: graph.totalEdges,
    });
  }

  const merged = mergeLayerGraphs(projectRoot, layers);

  return { layers, layerMetadata, merged };
}

/**
 * Auto-detect cross-layer connections by scanning file contents
 * for references to identifiers defined in other layers.
 *
 * Strategies:
 * 1. Unique type-name matching — PascalCase/snake_case names unique to exactly
 *    one target layer, with context validation (not self-definitions, not
 *    local imports, not ambiguous across layers).
 * 2. Typed reference patterns — "StorageClient", "AuthService", etc.
 * 3. Cross-layer import/URL patterns — import paths or URL patterns referencing
 *    another layer's directory, with strict context for short names.
 *
 * Results are deduplicated to max 1 connection per (sourceLayer → targetLayer) pair,
 * keeping the highest-scoring match. A minimum score threshold is enforced.
 */
export function detectCrossLayerConnections(
  layers: Record<string, DependencyGraph>,
  layerDefs: LayerDefinition[],
): CrossLayerConnection[] {
  const MIN_NAME_LENGTH = 6;
  const MIN_SCORE_THRESHOLD = 10;

  // Build identifier map per layer: { layerName → { identifierName → filePath } }
  const layerIdentifiers = new Map<string, Map<string, string>>();
  for (const [layerName, graph] of Object.entries(layers)) {
    const identifiers = new Map<string, string>();
    for (const filePath of Object.keys(graph.files)) {
      const basename = filePath.split("/").pop()!;
      const nameNoExt = basename.replace(/\.[^.]+$/, "");
      if (nameNoExt.length < MIN_NAME_LENGTH || GENERIC_BASENAMES.has(nameNoExt.toLowerCase())) continue;
      identifiers.set(nameNoExt, filePath);
    }
    layerIdentifiers.set(layerName, identifiers);
  }

  // Pre-compute: names that exist in 2+ layers → ambiguous, skip
  const nameLayerCount = new Map<string, number>();
  for (const [, ids] of layerIdentifiers) {
    for (const name of ids.keys()) {
      nameLayerCount.set(name, (nameLayerCount.get(name) ?? 0) + 1);
    }
  }

  // Track best connection per (source→target) layer pair, with score
  const pairBest = new Map<string, { conn: CrossLayerConnection; score: number }>();

  function tryAdd(pairKey: string, conn: CrossLayerConnection, score: number) {
    if (score < MIN_SCORE_THRESHOLD) return; // discard low-quality
    const existing = pairBest.get(pairKey);
    if (!existing || score > existing.score) {
      pairBest.set(pairKey, { conn, score });
    }
  }

  // Regex for detecting self-definitions (class Foo, struct Foo, etc.)
  function isSelfDefined(content: string, name: string): boolean {
    const defPatterns = [
      new RegExp(`\\b(?:class|struct|enum|interface|protocol|type|object)\\s+${escapeRegex(name)}\\b`),
      new RegExp(`\\b(?:def|func|fun|fn)\\s+${escapeRegex(name)}\\b`),
      new RegExp(`\\b${escapeRegex(name)}\\s*=\\s*(?:class|struct|type|interface)\\b`),
    ];
    return defPatterns.some((re) => re.test(content));
  }

  // Check if a name match appears only in local import context (not cross-layer)
  function isLocalImportOnly(content: string, name: string): boolean {
    const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, "g");
    const lines = content.split("\n");
    let crossLayerRef = false;
    for (const line of lines) {
      if (!regex.test(line)) continue;
      regex.lastIndex = 0;
      // Local import patterns: from . / from .. / require('./ / import ./ / #include "
      const isLocalImport = /^\s*(?:from\s+[.'"]|import\s+[.'"]|require\s*\(\s*['"][.\/]|#include\s*")/.test(line);
      if (!isLocalImport) {
        crossLayerRef = true;
        break;
      }
    }
    return !crossLayerRef;
  }

  for (const [sourceLayer, graph] of Object.entries(layers)) {
    const ownNames = layerIdentifiers.get(sourceLayer) ?? new Map();

    for (const filePath of Object.keys(graph.files)) {
      const absPath = join(graph.rootDir, filePath);
      let content: string;
      try {
        content = readFileSync(absPath, "utf-8");
      } catch { continue; }

      // Strategy 1: File-name matching across layers
      for (const [targetLayer, targetIds] of layerIdentifiers) {
        if (targetLayer === sourceLayer) continue;
        for (const [targetName, targetFile] of targetIds) {
          // Skip if name exists in source layer (own concept)
          if (ownNames.has(targetName)) continue;
          // Skip if name exists in 2+ layers (ambiguous — e.g. ProfileScreen in both Mobile and Android)
          if ((nameLayerCount.get(targetName) ?? 0) > 1) continue;
          if (!content.includes(targetName)) continue;
          const regex = new RegExp(`\\b${escapeRegex(targetName)}\\b`);
          if (!regex.test(content)) continue;
          // Skip if source file defines this name itself (e.g. class AuthService in auth_service.dart)
          if (isSelfDefined(content, targetName)) continue;
          // Skip if only appears in local import context (from ./foo import bar)
          if (isLocalImportOnly(content, targetName)) continue;

          const pairKey = `${sourceLayer}→${targetLayer}`;
          // Score: longer + PascalCase names are more specific
          const isPascalCase = /^[A-Z][a-z]/.test(targetName);
          const baseScore = targetName.length + (isPascalCase ? 5 : 0);
          tryAdd(pairKey, {
            fromLayer: sourceLayer,
            fromFile: filePath,
            toLayer: targetLayer,
            toFile: targetFile,
            type: "auto",
            label: targetName,
          }, baseScore);
        }
      }

      // Strategy 2: Typed reference patterns (StorageClient, AuthService, etc.)
      for (const def of layerDefs) {
        if (def.name === sourceLayer) continue;
        const pairKey = `${sourceLayer}→${def.name}`;
        const layerName = def.name;
        const suffixes = ["Client", "Service", "API", "Handler", "Provider", "Manager", "Gateway", "Proxy", "Adapter", "Connector"];
        const typedRe = new RegExp(`\\b${escapeRegex(layerName)}(?:${suffixes.join("|")})\\b`);
        if (typedRe.test(content)) {
          const targetGraph = layers[def.name];
          if (!targetGraph) continue;
          const entryFile = findEntryPoint(targetGraph);
          if (entryFile) {
            tryAdd(pairKey, {
              fromLayer: sourceLayer,
              fromFile: filePath,
              toLayer: def.name,
              toFile: entryFile,
              type: "auto",
              label: `${layerName}*`,
            }, 25);
          }
        }
      }

      // Strategy 3: Cross-layer import/URL patterns
      for (const def of layerDefs) {
        if (def.name === sourceLayer) continue;
        const pairKey = `${sourceLayer}→${def.name}`;
        const dirName = def.targetDir.split("/").pop()!;
        const isShortName = dirName.length <= 4;

        const patterns: { re: RegExp; score: number }[] = [];

        if (!isShortName) {
          // Longer dir names: moderate context needed
          // Import context: from <dir> import / require('<dir>/...')
          patterns.push({ re: new RegExp(`(?:from|require|import)\\s+['"].*\\b${escapeRegex(dirName)}\\b`, "i"), score: 15 });
          // URL path: /<dir>/
          patterns.push({ re: new RegExp(`['"\`/]${escapeRegex(dirName)}/[\\w]`, "i"), score: 12 });
        } else {
          // Short dir names (api, auth, cms, ios): require strict context
          // Must appear in import/require with path separator
          patterns.push({ re: new RegExp(`(?:from|require|import)\\s+['"].*/${escapeRegex(dirName)}/`, "i"), score: 13 });
          // URL path: must have leading / and trailing /
          patterns.push({ re: new RegExp(`['"\`]\\s*(?:https?://[^'"]*)?/${escapeRegex(dirName)}/[\\w]`, "i"), score: 11 });
        }

        for (const { re, score } of patterns) {
          if (re.test(content)) {
            const targetGraph = layers[def.name];
            if (!targetGraph) continue;
            const entryFile = findEntryPoint(targetGraph);
            if (entryFile) {
              tryAdd(pairKey, {
                fromLayer: sourceLayer,
                fromFile: filePath,
                toLayer: def.name,
                toFile: entryFile,
                type: "auto",
                label: `→ ${def.name}`,
              }, score);
            }
            break;
          }
        }
      }
    }
  }

  return [...pairBest.values()].map((v) => v.conn);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Find the most likely entry point file in a layer's graph */
function findEntryPoint(graph: DependencyGraph): string | null {
  const files = Object.values(graph.files);
  if (files.length === 0) return null;

  // Prefer files with most dependents (highest fan-in)
  const sorted = files.sort((a, b) => b.dependents.length - a.dependents.length);
  if (sorted[0].dependents.length > 0) return sorted[0].path;

  // Fallback: common entry point names
  const entryNames = ["main", "index", "app", "server", "lib", "mod"];
  for (const name of entryNames) {
    const entry = files.find((f) => {
      const basename = f.path.split("/").pop()!.replace(/\.[^.]+$/, "").toLowerCase();
      return basename === name;
    });
    if (entry) return entry.path;
  }

  return files[0].path;
}

/** Generic basenames that would cause too many false positives */
const GENERIC_BASENAMES = new Set([
  // Build / project structure
  "index", "main", "app", "config", "setup", "init", "mod", "package",
  "build", "makefile", "dockerfile", "rakefile", "gemfile", "podfile",
  // Common modules
  "utils", "helpers", "types", "models", "views", "controllers", "services",
  "lib", "src", "test", "spec", "tests", "bench", "example", "examples",
  // Infrastructure / patterns
  "server", "client", "routes", "middleware", "database", "engine",
  "error", "errors", "logger", "logging", "constants", "common", "base",
  "core", "data", "manager", "handler", "factory", "context", "state",
  "store", "cache", "queue", "task", "worker", "adapter", "bridge",
  // UI / presentation
  "event", "events", "model", "view", "home", "user", "page", "layout",
  "router", "provider", "component", "widget", "screen", "template",
  "header", "footer", "sidebar", "navbar", "dialog", "modal", "panel",
  // Data / IO
  "reader", "writer", "parser", "formatter", "serializer", "converter",
  "loader", "exporter", "importer", "transformer", "mapper", "reducer",
  "filter", "sorter", "validator", "checker", "scanner", "analyzer",
  // Auth / Security (generic enough to exist in many layers)
  "login", "register", "verify", "token", "session", "credential",
  "password", "permission", "profile", "account", "settings",
  // Network / API
  "request", "response", "endpoint", "controller", "service", "gateway",
  "proxy", "connector", "socket", "channel", "stream", "pipeline",
  // Storage / DB
  "schema", "migration", "seed", "fixture", "record", "entity",
  "repository", "storage", "driver", "connection", "pool",
  // Testing
  "mock", "stub", "fake", "helper", "fixture", "factory",
]);

/**
 * Merge multiple layer graphs into a single DependencyGraph.
 * Node paths are prefixed: "LayerName/original/path.ext"
 */
function mergeLayerGraphs(
  projectRoot: string,
  layers: Record<string, DependencyGraph>,
): DependencyGraph {
  const mergedFiles: Record<string, FileNode> = {};
  const mergedEdges: DependencyEdge[] = [];
  const mergedCircular: { cycle: string[] }[] = [];

  for (const [layerName, graph] of Object.entries(layers)) {
    for (const [origPath, node] of Object.entries(graph.files)) {
      const prefixedPath = `${layerName}/${origPath}`;
      mergedFiles[prefixedPath] = {
        path: prefixedPath,
        exists: node.exists,
        dependencies: node.dependencies.map((d) => `${layerName}/${d}`),
        dependents: node.dependents.map((d) => `${layerName}/${d}`),
      };
    }

    for (const edge of graph.edges) {
      mergedEdges.push({
        source: `${layerName}/${edge.source}`,
        target: `${layerName}/${edge.target}`,
        type: edge.type,
      });
    }

    for (const circ of graph.circularDependencies) {
      mergedCircular.push({
        cycle: circ.cycle.map((f) => `${layerName}/${f}`),
      });
    }
  }

  return {
    rootDir: resolve(projectRoot),
    files: mergedFiles,
    edges: mergedEdges,
    circularDependencies: mergedCircular,
    totalFiles: Object.keys(mergedFiles).length,
    totalEdges: mergedEdges.length,
  };
}
