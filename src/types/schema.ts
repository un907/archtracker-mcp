/**
 * ArchTracker core schema definitions.
 * Snapshot format is versioned for backward compatibility.
 */

export const SCHEMA_VERSION = "1.0" as const;

/** A single dependency edge: source imports target */
export interface DependencyEdge {
  source: string;
  target: string;
  type: "static" | "dynamic" | "type-only";
}

/** A file node in the architecture graph */
export interface FileNode {
  path: string;
  exists: boolean;
  dependencies: string[];
  dependents: string[];
}

/** The full dependency graph */
export interface DependencyGraph {
  rootDir: string;
  files: Record<string, FileNode>;
  edges: DependencyEdge[];
  totalFiles: number;
  totalEdges: number;
}

/** Persisted snapshot with schema version */
export interface ArchSnapshot {
  version: typeof SCHEMA_VERSION;
  timestamp: string;
  rootDir: string;
  graph: DependencyGraph;
}

/** Diff result between two snapshots */
export interface ArchDiff {
  added: string[];
  removed: string[];
  modified: string[];
  affectedDependents: Array<{
    file: string;
    reason: string;
    dependsOn: string;
  }>;
}

/** Context summary for AI session initialization */
export interface ArchContext {
  validPaths: string[];
  summary: string;
  snapshotExists: boolean;
  snapshotTimestamp?: string;
  keyComponents: Array<{
    path: string;
    dependentCount: number;
    dependencyCount: number;
  }>;
}
