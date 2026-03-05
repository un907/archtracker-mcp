import { resolve, relative } from "node:path";
import { cruise } from "dependency-cruiser";
import type { ICruiseResult } from "dependency-cruiser";
import type {
  DependencyGraph,
  DependencyEdge,
  FileNode,
  CircularDependency,
} from "../types/schema.js";

/** Options for the dependency analyzer */
export interface AnalyzeOptions {
  /** Regex patterns to exclude from analysis (e.g. ["node_modules", "\\.test\\.ts$"]) */
  exclude?: string[];
  /** Maximum recursion depth (0 = unlimited) */
  maxDepth?: number;
  /** Path to tsconfig.json (auto-detected if omitted) */
  tsConfigPath?: string;
  /** Include type-only imports (import type {...}) */
  includeTypeOnly?: boolean;
}

const DEFAULT_EXCLUDE = [
  "node_modules",
  "\\.d\\.ts$",
  "dist",
  "build",
  "coverage",
  "\\.archtracker",
];

/**
 * Analyze project dependencies using dependency-cruiser.
 *
 * dependency-cruiser records module paths relative to CWD.
 * We resolve rootDir to an absolute path, then use it as baseDir
 * so that output paths are relative to rootDir.
 *
 * @param rootDir - Directory to analyze (e.g. "src" or absolute path)
 * @param options - Analysis configuration
 * @returns DependencyGraph with files, edges, and circular dependency warnings
 */
export async function analyzeProject(
  rootDir: string,
  options: AnalyzeOptions = {},
): Promise<DependencyGraph> {
  const {
    exclude = [],
    maxDepth = 0,
    tsConfigPath,
    includeTypeOnly = true,
  } = options;

  const absRootDir = resolve(rootDir);
  const allExclude = [...DEFAULT_EXCLUDE, ...exclude];
  const excludePattern = allExclude.join("|");

  // Cruise "." relative to absRootDir as baseDir,
  // so all output paths are relative to the target directory
  const cruiseOptions: Record<string, unknown> = {
    baseDir: absRootDir,
    exclude: { path: excludePattern },
    doNotFollow: { path: "node_modules" },
    maxDepth,
    tsPreCompilationDeps: includeTypeOnly ? true : false,
    combinedDependencies: false,
  };

  if (tsConfigPath) {
    cruiseOptions.tsConfig = { fileName: tsConfigPath };
  }

  let result;
  try {
    result = await cruise(["."], cruiseOptions);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AnalyzerError(
      `dependency-cruiser の実行に失敗しました: ${message}`,
      { cause: error },
    );
  }

  if (result.exitCode !== 0 && !result.output) {
    throw new AnalyzerError(
      `解析がエラーコード ${result.exitCode} で終了しました`,
    );
  }

  const cruiseResult = result.output as ICruiseResult;
  return buildGraph(absRootDir, cruiseResult);
}

/** Convert dependency-cruiser output to our DependencyGraph format */
function buildGraph(
  rootDir: string,
  cruiseResult: ICruiseResult,
): DependencyGraph {
  const files: Record<string, FileNode> = {};
  const edges: DependencyEdge[] = [];
  const circularSet = new Set<string>();
  const circularDependencies: CircularDependency[] = [];

  // First pass: register all files
  for (const mod of cruiseResult.modules) {
    files[mod.source] = {
      path: mod.source,
      exists: !mod.couldNotResolve,
      dependencies: [],
      dependents: [],
    };
  }

  // Second pass: build edges and dependency lists
  for (const mod of cruiseResult.modules) {
    for (const dep of mod.dependencies) {
      // Skip unresolvable and core modules
      if (dep.couldNotResolve || dep.coreModule) continue;

      const edgeType = dep.typeOnly
        ? ("type-only" as const)
        : dep.dynamic
          ? ("dynamic" as const)
          : ("static" as const);

      edges.push({
        source: mod.source,
        target: dep.resolved,
        type: edgeType,
      });

      // Update dependency/dependent lists
      if (files[mod.source]) {
        files[mod.source].dependencies.push(dep.resolved);
      }
      if (files[dep.resolved]) {
        files[dep.resolved].dependents.push(mod.source);
      }

      // Detect circular dependencies
      if (dep.circular && dep.cycle) {
        const cyclePath = dep.cycle.map((c) => c.name);
        const cycleKey = [...cyclePath].sort().join("→");
        if (!circularSet.has(cycleKey)) {
          circularSet.add(cycleKey);
          circularDependencies.push({ cycle: cyclePath });
        }
      }
    }
  }

  return {
    rootDir,
    files,
    edges,
    circularDependencies,
    totalFiles: Object.keys(files).length,
    totalEdges: edges.length,
  };
}

/** Custom error class for analyzer failures */
export class AnalyzerError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message);
    this.name = "AnalyzerError";
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}
