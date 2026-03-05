import type { DependencyGraph, FileNode } from "../types/schema.js";
import { t } from "../i18n/index.js";

/** Search result for architecture queries */
export interface SearchResult {
  file: string;
  dependents: string[];
  dependencies: string[];
  dependentCount: number;
  dependencyCount: number;
  matchReason: string;
}

/**
 * Search the dependency graph by file path pattern.
 * Pattern is treated as a literal substring (escaped to prevent ReDoS).
 */
export function searchByPath(
  graph: DependencyGraph,
  pattern: string,
): SearchResult[] {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "i");
  return Object.values(graph.files)
    .filter((f) => regex.test(f.path))
    .map((f) => toSearchResult(f, t("search.pathMatch", { pattern })));
}

/**
 * Find all files that would be affected if a given file changes.
 * Traverses the dependent chain recursively (reverse dependency tree).
 */
export function findAffectedFiles(
  graph: DependencyGraph,
  filePath: string,
  maxDepth: number = 10,
): SearchResult[] {
  const node = findNode(graph, filePath);
  if (!node) return [];

  const visited = new Set<string>();
  const results: SearchResult[] = [];

  function traverse(current: FileNode, depth: number, via: string) {
    if (depth > maxDepth || visited.has(current.path)) return;
    visited.add(current.path);

    if (current.path !== node!.path) {
      results.push(
        toSearchResult(
          current,
          t("search.affected", { file: filePath, via }),
        ),
      );
    }

    for (const depPath of current.dependents) {
      const depNode = graph.files[depPath];
      if (depNode) {
        traverse(depNode, depth + 1, current.path);
      }
    }
  }

  traverse(node, 0, filePath);
  return results;
}

/**
 * Find the most critical files in the project.
 * Ranked by dependent count (files that many other files depend on).
 */
export function findCriticalFiles(
  graph: DependencyGraph,
  limit: number = 10,
): SearchResult[] {
  return Object.values(graph.files)
    .filter((f) => f.dependents.length > 0)
    .sort((a, b) => b.dependents.length - a.dependents.length)
    .slice(0, limit)
    .map((f) =>
      toSearchResult(f, t("search.critical", { count: f.dependents.length })),
    );
}

/**
 * Find orphan files (no dependencies and no dependents).
 */
export function findOrphanFiles(graph: DependencyGraph): SearchResult[] {
  return Object.values(graph.files)
    .filter((f) => f.dependents.length === 0 && f.dependencies.length === 0)
    .map((f) => toSearchResult(f, t("search.orphan")));
}

/** Find a node by exact or partial path match */
function findNode(
  graph: DependencyGraph,
  filePath: string,
): FileNode | undefined {
  // Exact match
  if (graph.files[filePath]) return graph.files[filePath];

  // Partial match (find first file ending with the pattern)
  const key = Object.keys(graph.files).find(
    (k) => k.endsWith(filePath) || k.includes(filePath),
  );
  return key ? graph.files[key] : undefined;
}

function toSearchResult(node: FileNode, matchReason: string): SearchResult {
  return {
    file: node.path,
    dependents: node.dependents,
    dependencies: node.dependencies,
    dependentCount: node.dependents.length,
    dependencyCount: node.dependencies.length,
    matchReason,
  };
}
