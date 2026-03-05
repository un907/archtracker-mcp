import type { ArchDiff, DependencyGraph } from "../types/schema.js";

/**
 * Compute the diff between an old and new dependency graph.
 *
 * Identifies:
 * - Added files (new in the codebase)
 * - Removed files (deleted from the codebase)
 * - Modified files (dependencies changed)
 * - Affected dependents (files that depend on changed/removed files and may need updates)
 */
export function computeDiff(
  oldGraph: DependencyGraph,
  newGraph: DependencyGraph,
): ArchDiff {
  const oldFiles = new Set(Object.keys(oldGraph.files));
  const newFiles = new Set(Object.keys(newGraph.files));

  // Files that exist in new but not in old
  const added = [...newFiles].filter((f) => !oldFiles.has(f));

  // Files that existed in old but not in new
  const removed = [...oldFiles].filter((f) => !newFiles.has(f));

  // Files that exist in both but have different dependency sets
  const modified: string[] = [];
  for (const file of newFiles) {
    if (!oldFiles.has(file)) continue;

    const oldDeps = oldGraph.files[file].dependencies.slice().sort();
    const newDeps = newGraph.files[file].dependencies.slice().sort();

    if (!arraysEqual(oldDeps, newDeps)) {
      modified.push(file);
    }
  }

  // Find all files that depend on changed/removed files
  const changedFiles = new Set([...removed, ...modified]);
  const affectedDependents: ArchDiff["affectedDependents"] = [];
  const seenAffected = new Set<string>();

  for (const changedFile of changedFiles) {
    // Look up dependents in the NEW graph (for modified files)
    // and in the OLD graph (for removed files)
    const graph = removed.includes(changedFile) ? oldGraph : newGraph;
    const node = graph.files[changedFile];
    if (!node) continue;

    for (const dependent of node.dependents) {
      const key = `${dependent}→${changedFile}`;
      if (seenAffected.has(key)) continue;
      seenAffected.add(key);

      const reason = removed.includes(changedFile)
        ? `依存先 "${changedFile}" が削除されました`
        : `依存先 "${changedFile}" の依存関係が変更されました`;

      affectedDependents.push({
        file: dependent,
        reason,
        dependsOn: changedFile,
      });
    }
  }

  // Also check for files that depend on added files
  // (new dependencies that might need verification)
  for (const addedFile of added) {
    const node = newGraph.files[addedFile];
    if (!node) continue;

    for (const dependent of node.dependents) {
      const key = `${dependent}→${addedFile}`;
      if (seenAffected.has(key)) continue;
      seenAffected.add(key);

      affectedDependents.push({
        file: dependent,
        reason: `新しい依存先 "${addedFile}" が追加されました`,
        dependsOn: addedFile,
      });
    }
  }

  return { added, removed, modified, affectedDependents };
}

/** Generate a human-readable report from an ArchDiff */
export function formatDiffReport(diff: ArchDiff): string {
  const lines: string[] = [];

  lines.push("# アーキテクチャ変更レポート\n");

  if (diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0) {
    lines.push("変更なし — スナップショットと現在のコードは一致しています。\n");
    return lines.join("\n");
  }

  if (diff.added.length > 0) {
    lines.push(`## 追加されたファイル (${diff.added.length}件)`);
    for (const f of diff.added) {
      lines.push(`  + ${f}`);
    }
    lines.push("");
  }

  if (diff.removed.length > 0) {
    lines.push(`## 削除されたファイル (${diff.removed.length}件)`);
    for (const f of diff.removed) {
      lines.push(`  - ${f}`);
    }
    lines.push("");
  }

  if (diff.modified.length > 0) {
    lines.push(`## 依存関係が変更されたファイル (${diff.modified.length}件)`);
    for (const f of diff.modified) {
      lines.push(`  ~ ${f}`);
    }
    lines.push("");
  }

  if (diff.affectedDependents.length > 0) {
    lines.push(`## ⚠ 確認が必要なファイル (${diff.affectedDependents.length}件)`);
    for (const a of diff.affectedDependents) {
      lines.push(`  ! ${a.file}`);
      lines.push(`    理由: ${a.reason}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
