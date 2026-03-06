import { resolve } from "node:path";
import type {
  DependencyGraph,
  DependencyEdge,
  FileNode,
  LayerMetadata,
  MultiLayerGraph,
} from "../types/schema.js";
import type { LayerDefinition } from "../types/layers.js";
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
