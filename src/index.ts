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
} from "./types/schema.js";
export { SCHEMA_VERSION } from "./types/schema.js";
export { analyzeProject, AnalyzerError } from "./analyzer/index.js";
export type { AnalyzeOptions } from "./analyzer/index.js";
export { saveSnapshot, loadSnapshot, hasArchtrackerDir, StorageError } from "./storage/index.js";
export { computeDiff, formatDiffReport } from "./storage/index.js";
