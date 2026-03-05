import type { ArchSnapshot } from "../types/schema.js";

/**
 * Save / load snapshots to .archtracker/snapshot.json.
 * Placeholder — implemented in Phase 3.
 */
export async function saveSnapshot(
  _projectRoot: string,
  _snapshot: ArchSnapshot,
): Promise<void> {
  throw new Error("Not implemented — Phase 3");
}

export async function loadSnapshot(
  _projectRoot: string,
): Promise<ArchSnapshot | null> {
  throw new Error("Not implemented — Phase 3");
}
