import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import type { ArchSnapshot } from "../types/schema.js";
import { SCHEMA_VERSION } from "../types/schema.js";
import type { DependencyGraph } from "../types/schema.js";

const ARCHTRACKER_DIR = ".archtracker";
const SNAPSHOT_FILE = "snapshot.json";

/**
 * Save a dependency graph as a versioned snapshot.
 *
 * Creates .archtracker/ directory if it doesn't exist.
 * Writes snapshot.json with schema version and timestamp.
 */
export async function saveSnapshot(
  projectRoot: string,
  graph: DependencyGraph,
): Promise<ArchSnapshot> {
  const dirPath = join(projectRoot, ARCHTRACKER_DIR);
  const filePath = join(dirPath, SNAPSHOT_FILE);

  const snapshot: ArchSnapshot = {
    version: SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    rootDir: graph.rootDir,
    graph,
  };

  await mkdir(dirPath, { recursive: true });
  await writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf-8");

  return snapshot;
}

/**
 * Load the most recent snapshot from .archtracker/snapshot.json.
 *
 * Returns null if no snapshot exists.
 * Validates schema version for backward compatibility.
 */
export async function loadSnapshot(
  projectRoot: string,
): Promise<ArchSnapshot | null> {
  const filePath = join(projectRoot, ARCHTRACKER_DIR, SNAPSHOT_FILE);

  try {
    await access(filePath);
  } catch {
    return null;
  }

  const raw = await readFile(filePath, "utf-8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new StorageError(
      `snapshot.json のパースに失敗しました。ファイルが破損している可能性があります: ${filePath}`,
    );
  }

  const snapshot = parsed as ArchSnapshot;

  if (!snapshot.version) {
    throw new StorageError(
      `snapshot.json にバージョン情報がありません。再生成してください: archtracker init`,
    );
  }

  if (snapshot.version !== SCHEMA_VERSION) {
    throw new StorageError(
      `snapshot.json のバージョン (${snapshot.version}) が現在のスキーマ (${SCHEMA_VERSION}) と互換性がありません。archtracker init で再生成してください。`,
    );
  }

  return snapshot;
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
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}
