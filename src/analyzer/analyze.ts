import type { DependencyGraph } from "../types/schema.js";

/**
 * Analyze project dependencies using dependency-cruiser.
 * Placeholder — implemented in Phase 2.
 */
export async function analyzeProject(
  _rootDir: string,
  _options?: { exclude?: string[]; maxDepth?: number },
): Promise<DependencyGraph> {
  throw new Error("Not implemented — Phase 2");
}
