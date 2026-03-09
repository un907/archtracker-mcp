/**
 * archtracker-mcp — Architecture & Dependency Tracker
 *
 * Public API re-exports for programmatic usage.
 */
export type {
  DependencyEdge,
  DependencyGraph,
  FileNode,
  CircularDependency,
  ArchSnapshot,
  ArchDiff,
  ArchContext,
  LayerMetadata,
  MultiLayerGraph,
} from "./types/schema.js";
export { SCHEMA_VERSION } from "./types/schema.js";
export type { LayerDefinition, LayerConfig, CrossLayerConnection } from "./types/layers.js";
export { analyzeProject, analyzeMultiLayer, detectCrossLayerConnections, AnalyzerError } from "./analyzer/index.js";
export type { AnalyzeOptions } from "./analyzer/index.js";
export { saveSnapshot, loadSnapshot, hasArchtrackerDir, loadLayerConfig, saveLayerConfig, StorageError } from "./storage/index.js";
export { computeDiff, formatDiffReport } from "./storage/index.js";
export { formatAnalysisReport } from "./analyzer/index.js";
export { t, setLocale, getLocale } from "./i18n/index.js";
export type { Locale } from "./i18n/index.js";
