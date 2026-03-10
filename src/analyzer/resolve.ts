/**
 * Shared graph resolution logic for CLI and MCP.
 * Centralizes multi-layer auto-detection to avoid duplicated code.
 */
import { analyzeProject } from "./analyze.js";
import { analyzeMultiLayer, detectCrossLayerConnections } from "./multi-layer.js";
import { loadLayerConfig } from "../storage/layers.js";
import type { DependencyGraph, MultiLayerGraph, LayerMetadata } from "../types/schema.js";
import type { CrossLayerConnection } from "../types/layers.js";
import type { LanguageId } from "./engines/types.js";

export interface ResolvedGraph {
  graph: DependencyGraph;
  multiLayer?: MultiLayerGraph;
  layerMetadata?: LayerMetadata[];
  crossLayerEdges?: CrossLayerConnection[];
}

/**
 * Resolve a dependency graph. When `useMultiLayer` is true and layers.json
 * exists, performs multi-layer analysis. Otherwise falls back to single-dir.
 *
 * @param useMultiLayer - Whether to attempt multi-layer detection.
 *   CLI: true when --target is NOT explicitly provided (auto-detect)
 *   MCP: true when targetDir === "src" (the default value)
 */
export async function resolveGraph(opts: {
  targetDir: string;
  projectRoot: string;
  useMultiLayer: boolean;
  exclude?: string[];
  language?: LanguageId;
}): Promise<ResolvedGraph> {
  if (opts.useMultiLayer) {
    const layerConfig = await loadLayerConfig(opts.projectRoot);
    if (layerConfig) {
      const multi = await analyzeMultiLayer(opts.projectRoot, layerConfig.layers);
      const autoConnections = detectCrossLayerConnections(multi.layers, layerConfig.layers);
      const manualConnections = layerConfig.connections ?? [];
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

  const graph = await analyzeProject(opts.targetDir, {
    exclude: opts.exclude,
    language: opts.language,
  });
  return { graph };
}
