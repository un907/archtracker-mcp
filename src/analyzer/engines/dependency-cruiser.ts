import { resolve } from "node:path";
import { cruise } from "dependency-cruiser";
import type { ICruiseResult } from "dependency-cruiser";
import type {
  DependencyGraph,
  DependencyEdge,
  FileNode,
  CircularDependency,
} from "../../types/schema.js";
import type { AnalyzerEngine } from "./types.js";

const DEFAULT_EXCLUDE = [
  "node_modules",
  "\\.d\\.ts$",
  "dist",
  "build",
  "coverage",
  "\\.archtracker",
];

export class DependencyCruiserEngine implements AnalyzerEngine {
  async analyze(
    rootDir: string,
    options: {
      exclude?: string[];
      maxDepth?: number;
      tsConfigPath?: string;
      includeTypeOnly?: boolean;
    } = {},
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
      throw new Error(`dependency-cruiser failed: ${message}`, {
        cause: error,
      });
    }

    if (result.exitCode !== 0 && !result.output) {
      throw new Error(`Analysis exited with code ${result.exitCode}`);
    }

    const cruiseResult = result.output as ICruiseResult;
    return this.buildGraph(absRootDir, cruiseResult);
  }

  private buildGraph(
    rootDir: string,
    cruiseResult: ICruiseResult,
  ): DependencyGraph {
    const files: Record<string, FileNode> = {};
    const edges: DependencyEdge[] = [];
    const circularSet = new Set<string>();
    const circularDependencies: CircularDependency[] = [];

    for (const mod of cruiseResult.modules) {
      if (this.isExternalModule(mod)) continue;
      files[mod.source] = {
        path: mod.source,
        exists: !mod.couldNotResolve,
        dependencies: [],
        dependents: [],
      };
    }

    for (const mod of cruiseResult.modules) {
      for (const dep of mod.dependencies) {
        if (dep.couldNotResolve || dep.coreModule) continue;
        if (!files[mod.source] || this.isExternalDep(dep)) continue;

        const edgeType = dep.typeOnly
          ? ("type-only" as const)
          : dep.dynamic
            ? ("dynamic" as const)
            : ("static" as const);

        edges.push({ source: mod.source, target: dep.resolved, type: edgeType });

        if (files[mod.source]) {
          files[mod.source].dependencies.push(dep.resolved);
        }
        if (files[dep.resolved]) {
          files[dep.resolved].dependents.push(mod.source);
        }

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

  private isExternalModule(mod: {
    source: string;
    coreModule?: boolean;
    dependencyTypes?: string[];
  }): boolean {
    if (mod.coreModule) return true;
    const depTypes = mod.dependencyTypes ?? [];
    if (depTypes.some((t) => t.startsWith("npm") || t === "core")) return true;
    return isExternalPath(mod.source);
  }

  private isExternalDep(dep: {
    resolved: string;
    coreModule: boolean;
    dependencyTypes: string[];
  }): boolean {
    if (dep.coreModule) return true;
    if (dep.dependencyTypes.some((t) => t.startsWith("npm") || t === "core"))
      return true;
    return isExternalPath(dep.resolved);
  }
}

function isExternalPath(source: string): boolean {
  if (source.startsWith("@")) return true;
  if (
    !source.includes("/") &&
    !source.includes("\\") &&
    !source.includes(".")
  )
    return true;
  if (source.startsWith("node:")) return true;
  return false;
}
