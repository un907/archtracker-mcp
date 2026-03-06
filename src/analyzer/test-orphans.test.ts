import { describe, it, expect } from "vitest";
import { analyzeProject } from "/Volumes/256/claudeproject/OSSMCP/src/analyzer/index.js";

async function analyzeAndReport(dir: string, lang: string) {
  const g = await analyzeProject(dir, { language: lang as any });
  const orphans = Object.values(g.files).filter(
    (f) => f.dependencies.length === 0 && f.dependents.length === 0,
  );
  return { totalFiles: g.totalFiles, totalEdges: g.totalEdges, orphans };
}

describe("orphan engine fixes", () => {
  it("Java - analytics", async () => {
    const r = await analyzeAndReport("/tmp/multi-layer-visual-test/analytics", "java");
    console.log(`Java: ${r.totalFiles} files, ${r.totalEdges} edges, ${r.orphans.length} orphans`);
    if (r.orphans.length > 0) console.log("  orphans:", r.orphans.map((f) => f.path));
    expect(r.totalEdges).toBeGreaterThan(0);
  });

  it("PHP - cms", async () => {
    const r = await analyzeAndReport("/tmp/multi-layer-visual-test/cms", "php");
    console.log(`PHP: ${r.totalFiles} files, ${r.totalEdges} edges, ${r.orphans.length} orphans`);
    if (r.orphans.length > 0) console.log("  orphans:", r.orphans.map((f) => f.path));
    expect(r.totalEdges).toBeGreaterThan(0);
  });

  it("Swift - ios", async () => {
    const r = await analyzeAndReport("/tmp/multi-layer-visual-test/ios", "swift");
    console.log(`Swift: ${r.totalFiles} files, ${r.totalEdges} edges, ${r.orphans.length} orphans`);
    if (r.orphans.length > 0) console.log("  orphans:", r.orphans.map((f) => f.path));
    expect(r.totalEdges).toBeGreaterThan(0);
  });

  it("Kotlin - android", async () => {
    const r = await analyzeAndReport("/tmp/multi-layer-visual-test/android", "kotlin");
    console.log(`Kotlin: ${r.totalFiles} files, ${r.totalEdges} edges, ${r.orphans.length} orphans`);
    if (r.orphans.length > 0) console.log("  orphans:", r.orphans.map((f) => f.path));
    expect(r.totalEdges).toBeGreaterThan(0);
  });

  it("Dart - mobile", async () => {
    const r = await analyzeAndReport("/tmp/multi-layer-visual-test/mobile", "dart");
    console.log(`Dart: ${r.totalFiles} files, ${r.totalEdges} edges, ${r.orphans.length} orphans`);
    if (r.orphans.length > 0) console.log("  orphans:", r.orphans.map((f) => f.path));
    expect(r.totalEdges).toBeGreaterThan(0);
  });

  it("Scala - datapipe", async () => {
    const r = await analyzeAndReport("/tmp/multi-layer-visual-test/datapipe", "scala");
    console.log(`Scala: ${r.totalFiles} files, ${r.totalEdges} edges, ${r.orphans.length} orphans`);
    if (r.orphans.length > 0) console.log("  orphans:", r.orphans.map((f) => f.path));
    expect(r.totalEdges).toBeGreaterThan(0);
  });
});
