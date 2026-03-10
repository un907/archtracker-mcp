export { analyzeProject, AnalyzerError } from "./analyze.js";
export type { AnalyzeOptions } from "./analyze.js";
export type { LanguageId } from "./engines/types.js";
export { detectLanguage } from "./engines/detect.js";
export {
  searchByPath,
  findAffectedFiles,
  findCriticalFiles,
  findOrphanFiles,
} from "./search.js";
export type { SearchResult } from "./search.js";
export { formatAnalysisReport } from "./report.js";
export { analyzeMultiLayer, detectCrossLayerConnections } from "./multi-layer.js";
export { resolveGraph } from "./resolve.js";
export type { ResolvedGraph } from "./resolve.js";
