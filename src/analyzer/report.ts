import type { DependencyGraph } from "../types/schema.js";
import { t } from "../i18n/index.js";

/**
 * Generate a comprehensive architecture analysis report.
 *
 * Designed for onboarding into existing projects — provides
 * a full overview of dependencies, critical components, circular
 * references, orphan files, coupling hotspots, and directory breakdown.
 */
export function formatAnalysisReport(
  graph: DependencyGraph,
  options: { topN?: number } = {},
): string {
  const topN = options.topN ?? 10;
  const lines: string[] = [];
  const files = Object.values(graph.files);

  // ─── Overview ────────────────────────────────────────────
  lines.push(t("analyze.title"));
  lines.push(t("analyze.overview"));
  lines.push(t("analyze.totalFiles", { count: graph.totalFiles }));
  lines.push(t("analyze.totalEdges", { count: graph.totalEdges }));
  lines.push(t("analyze.totalCircular", { count: graph.circularDependencies.length }));

  // ─── Critical Components ─────────────────────────────────
  const critical = files
    .filter((f) => f.dependents.length > 0)
    .sort((a, b) => b.dependents.length - a.dependents.length)
    .slice(0, topN);

  if (critical.length > 0) {
    lines.push(t("analyze.criticalTitle", { count: critical.length }));
    for (const f of critical) {
      lines.push(t("analyze.criticalItem", { path: f.path, count: f.dependents.length }));
    }
  }

  // ─── Circular Dependencies ──────────────────────────────
  if (graph.circularDependencies.length > 0) {
    lines.push(t("analyze.circularTitle", { count: graph.circularDependencies.length }));
    for (const c of graph.circularDependencies) {
      lines.push(t("analyze.circularItem", { files: c.cycle.join(" → ") }));
    }
  }

  // ─── High Coupling (most imports) ───────────────────────
  const highCoupling = files
    .filter((f) => f.dependencies.length > 0)
    .sort((a, b) => b.dependencies.length - a.dependencies.length)
    .slice(0, topN);

  if (highCoupling.length > 0) {
    lines.push(t("analyze.couplingTitle", { count: highCoupling.length }));
    for (const f of highCoupling) {
      lines.push(t("analyze.couplingItem", { path: f.path, count: f.dependencies.length }));
    }
  }

  // ─── Orphan Files ───────────────────────────────────────
  const orphans = files.filter(
    (f) => f.dependents.length === 0 && f.dependencies.length === 0,
  );

  if (orphans.length > 0) {
    lines.push(t("analyze.orphanTitle", { count: orphans.length }));
    for (const f of orphans) {
      lines.push(`  ${f.path}`);
    }
  }

  // ─── Directory Breakdown ────────────────────────────────
  const dirCounts = new Map<string, number>();
  for (const f of files) {
    const dir = f.path.includes("/") ? f.path.substring(0, f.path.lastIndexOf("/")) : ".";
    dirCounts.set(dir, (dirCounts.get(dir) ?? 0) + 1);
  }

  if (dirCounts.size > 1) {
    lines.push(t("analyze.layerTitle"));
    const sorted = [...dirCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [dir, count] of sorted) {
      lines.push(t("analyze.layerItem", { dir, count }));
    }
  }

  // ─── Summary ────────────────────────────────────────────
  if (graph.circularDependencies.length === 0 && orphans.length === 0) {
    lines.push(t("analyze.noIssues"));
  }

  return lines.join("\n");
}
