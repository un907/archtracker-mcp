/**
 * ArchTracker core schema definitions.
 * Snapshot format is versioned for backward compatibility.
 */

export const SCHEMA_VERSION = "1.1" as const;

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

/** A detected circular dependency */
export interface CircularDependency {
  cycle: string[];
}

/** The full dependency graph */
export interface DependencyGraph {
  rootDir: string;
  files: Record<string, FileNode>;
  edges: DependencyEdge[];
  circularDependencies: CircularDependency[];
  totalFiles: number;
  totalEdges: number;
}

/** Metadata about a single layer within a multi-layer graph */
export interface LayerMetadata {
  name: string;
  originalRootDir: string;
  language: string;
  color: string;
  description?: string;
  fileCount: number;
  edgeCount: number;
}

/** A multi-layer dependency graph combining multiple single-layer analyses */
export interface MultiLayerGraph {
  /** Individual layer graphs (un-prefixed paths, original rootDirs) */
  layers: Record<string, DependencyGraph>;
  /** Layer metadata for rendering */
  layerMetadata: LayerMetadata[];
  /** Merged graph with layer-prefixed paths ("LayerName/path.ts") */
  merged: DependencyGraph;
}

/** Persisted snapshot with schema version */
export interface ArchSnapshot {
  version: typeof SCHEMA_VERSION | "1.0";
  timestamp: string;
  rootDir: string;
  graph: DependencyGraph;
  /** Present only when layers.json was used */
  multiLayer?: MultiLayerGraph;
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
