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
 * 1. Unique type-name matching: PascalCase names (≥6 chars) unique to one layer
 * 2. Layer-name in import contexts: "from <layer> import" / "/<layer>/" etc.
 *
 * Results are deduplicated to max 1 connection per (sourceLayer → targetLayer) pair.
 */
export function detectCrossLayerConnections(
  layers: Record<string, DependencyGraph>,
  layerDefs: LayerDefinition[],
): CrossLayerConnection[] {
  // Build identifier map per layer: { layerName → { identifierName → filePath } }
  const layerIdentifiers = new Map<string, Map<string, string>>();
  for (const [layerName, graph] of Object.entries(layers)) {
    const identifiers = new Map<string, string>();
    for (const filePath of Object.keys(graph.files)) {
      const basename = filePath.split("/").pop()!;
      const nameNoExt = basename.replace(/\.[^.]+$/, "");
      if (nameNoExt.length < 5 || GENERIC_BASENAMES.has(nameNoExt.toLowerCase())) continue;
      identifiers.set(nameNoExt, filePath);
    }
    layerIdentifiers.set(layerName, identifiers);
  }

  // Track best connection per (source→target) layer pair, with score
  const pairBest = new Map<string, { conn: CrossLayerConnection; score: number }>();

  function tryAdd(pairKey: string, conn: CrossLayerConnection, score: number) {
    const existing = pairBest.get(pairKey);
    if (!existing || score > existing.score) {
      pairBest.set(pairKey, { conn, score });
    }
  }

  for (const [sourceLayer, graph] of Object.entries(layers)) {
    // Build source layer's own identifiers for exclusion
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
          // Skip if this name also exists in source layer (ambiguous)
          if (ownNames.has(targetName)) continue;
          if (!content.includes(targetName)) continue;
          const regex = new RegExp(`\\b${escapeRegex(targetName)}\\b`);
          if (regex.test(content)) {
            const pairKey = `${sourceLayer}→${targetLayer}`;
            // Score: longer name = more specific = higher confidence
            tryAdd(pairKey, {
              fromLayer: sourceLayer,
              fromFile: filePath,
              toLayer: targetLayer,
              toFile: targetFile,
              type: "auto",
              label: targetName,
            }, targetName.length);
          }
        }
      }

      // Strategy 2: Layer name / targetDir in import, URL, or string contexts
      for (const def of layerDefs) {
        if (def.name === sourceLayer) continue;
        const pairKey = `${sourceLayer}→${def.name}`;

        const layerName = def.name;
        const dirName = def.targetDir.split("/").pop()!;

        const patterns: { re: RegExp; score: number }[] = [
          // Direct reference: "StorageClient", "AuthService", etc.
          { re: new RegExp(`\\b${escapeRegex(layerName)}(?:Client|Service|API|Handler|Provider)\\b`), score: 20 },
          // Import context: from <layer> import, require('<layer>/...')
          { re: new RegExp(`(?:from|require|import).*\\b${escapeRegex(dirName)}\\b`, "i"), score: 15 },
          // URL path: /api/, /auth/, /storage/
          { re: new RegExp(`['"\`]\\s*/(?:api/)?${escapeRegex(dirName)}[/'"\`]`, "i"), score: 12 },
          // String containing layer name in service context
          { re: new RegExp(`['"\`]${escapeRegex(dirName)}['"\`]`, "i"), score: 8 },
        ];

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
  "index", "main", "app", "config", "utils", "helpers", "types", "models",
  "views", "controllers", "services", "lib", "src", "test", "spec",
  "setup", "init", "mod", "package", "build", "server", "client",
  "routes", "middleware", "database", "error", "errors", "logger",
  "constants", "common", "base", "core", "data", "manager", "handler",
  "factory", "context", "state", "store", "cache", "queue", "task",
  "worker", "event", "events", "model", "view", "home", "user", "page",
  "layout", "router", "provider", "component", "widget", "screen",
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
