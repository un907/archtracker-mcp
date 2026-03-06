import { createServer } from "node:http";
import type { DependencyGraph, ArchDiff, LayerMetadata } from "../types/schema.js";
import type { CrossLayerConnection } from "../types/layers.js";
import { buildGraphPage } from "./template.js";
import { getLocale } from "../i18n/index.js";
import type { Locale } from "../i18n/index.js";

/**
 * Start a local web server to visualize the dependency graph.
 *
 * Serves:
 * - GET /          → Interactive graph visualization (single HTML page)
 * - GET /api/graph → Raw graph data as JSON
 */
export function startViewer(
  graph: DependencyGraph,
  options: {
    port?: number;
    locale?: Locale;
    diff?: ArchDiff | null;
    layerMetadata?: LayerMetadata[];
    crossLayerEdges?: CrossLayerConnection[];
  } = {},
): { port: number; close: () => void } {
  const port = options.port ?? 3000;
  const locale = options.locale ?? getLocale();

  const html = buildGraphPage(graph, {
    locale,
    diff: options.diff,
    layerMetadata: options.layerMetadata,
    crossLayerEdges: options.crossLayerEdges,
  });
  const graphJson = JSON.stringify(graph);

  const server = createServer((req, res) => {
    if (req.url === "/api/graph") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(graphJson);
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });

  server.listen(port);

  return {
    port,
    close: () => server.close(),
  };
}
