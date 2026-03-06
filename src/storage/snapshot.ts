import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { ArchSnapshot, MultiLayerGraph } from "../types/schema.js";
import { SCHEMA_VERSION } from "../types/schema.js";
import type { DependencyGraph } from "../types/schema.js";
import { t } from "../i18n/index.js";

const ARCHTRACKER_DIR = ".archtracker";
const SNAPSHOT_FILE = "snapshot.json";

/** Zod schema for runtime validation of loaded snapshots */
const FileNodeSchema = z.object({
  path: z.string(),
  exists: z.boolean(),
  dependencies: z.array(z.string()),
  dependents: z.array(z.string()),
});

const DependencyGraphSchema = z.object({
  rootDir: z.string(),
  files: z.record(z.string(), FileNodeSchema),
  edges: z.array(z.object({
    source: z.string(),
    target: z.string(),
    type: z.enum(["static", "dynamic", "type-only"]),
  })),
  circularDependencies: z.array(z.object({ cycle: z.array(z.string()) })),
  totalFiles: z.number(),
  totalEdges: z.number(),
});

const SnapshotSchema = z.object({
  version: z.enum([SCHEMA_VERSION, "1.0"]),
  timestamp: z.string(),
  rootDir: z.string(),
  graph: DependencyGraphSchema,
});

/**
 * Save a dependency graph as a versioned snapshot.
 *
 * Creates .archtracker/ directory if it doesn't exist.
 * Writes snapshot.json with schema version and timestamp.
 */
export async function saveSnapshot(
  projectRoot: string,
  graph: DependencyGraph,
  multiLayer?: MultiLayerGraph,
): Promise<ArchSnapshot> {
  const dirPath = join(projectRoot, ARCHTRACKER_DIR);
  const filePath = join(dirPath, SNAPSHOT_FILE);

  const snapshot: ArchSnapshot = {
    version: SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    rootDir: graph.rootDir,
    graph,
    ...(multiLayer ? { multiLayer } : {}),
  };

  await mkdir(dirPath, { recursive: true });
  await writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf-8");

  return snapshot;
}

/**
 * Load the most recent snapshot from .archtracker/snapshot.json.
 *
 * Returns null if no snapshot exists.
 * Validates schema structure with Zod for data integrity.
 */
export async function loadSnapshot(
  projectRoot: string,
): Promise<ArchSnapshot | null> {
  const filePath = join(projectRoot, ARCHTRACKER_DIR, SNAPSHOT_FILE);

  // Read file directly — no TOCTOU race with access() check
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }
    throw new StorageError(
      t("storage.readFailed", { path: filePath }),
      { cause: error },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new StorageError(
      t("storage.parseFailed", { path: filePath }),
    );
  }

  // Validate structure with Zod
  const result = SnapshotSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .slice(0, 5)
      .join("\n");
    throw new StorageError(
      t("storage.invalidSchema", { issues }),
    );
  }

  return result.data as ArchSnapshot;
}

/** Check if .archtracker directory exists */
export async function hasArchtrackerDir(
  projectRoot: string,
): Promise<boolean> {
  try {
    await access(join(projectRoot, ARCHTRACKER_DIR));
    return true;
  } catch {
    return false;
  }
}

/** Custom error class for storage failures */
export class StorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StorageError";
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
