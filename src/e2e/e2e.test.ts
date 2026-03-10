import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { rmSync, existsSync } from "node:fs";
import http from "node:http";
import { analyzeProject } from "../analyzer/analyze.js";
import { startViewer } from "../web/server.js";
import { buildGraphPage } from "../web/template.js";
import { saveSnapshot, loadSnapshot, computeDiff } from "../storage/index.js";
import type { DependencyGraph } from "../types/schema.js";

const FIXTURE = join(import.meta.dirname, "..", "analyzer", "__fixtures__", "sample-project");
const TEST_ROOT = join(import.meta.dirname, "..", "..", ".e2e-test-tmp");

function fetch(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    }).on("error", reject);
  });
}

// ─── CLI E2E ──────────────────────────────────────────────

describe("CLI E2E", () => {
  const archtracker = join(import.meta.dirname, "..", "..", "dist", "cli", "index.js");
  const run = (args: string) =>
    execSync(`node ${archtracker} ${args}`, {
      cwd: TEST_ROOT,
      encoding: "utf-8",
      env: { ...process.env, LANG: "en_US.UTF-8" },
    });

  beforeAll(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    execSync(`mkdir -p ${TEST_ROOT}`);
  });

  afterAll(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  });

  it("init creates a snapshot", () => {
    const output = run(`init --target ${FIXTURE} --root ${TEST_ROOT}`);
    expect(output).toContain("Snapshot saved");
    expect(existsSync(join(TEST_ROOT, ".archtracker", "snapshot.json"))).toBe(true);
  });

  it("check reports no changes against same code", () => {
    const output = run(`check --target ${FIXTURE} --root ${TEST_ROOT}`);
    expect(output).toContain("No changes");
  });

  it("context shows file paths", () => {
    const output = run(`context --target ${FIXTURE} --root ${TEST_ROOT}`);
    expect(output).toContain("index.ts");
  });

  it("context --json returns valid JSON", () => {
    const output = run(`context --target ${FIXTURE} --root ${TEST_ROOT} --json`);
    const ctx = JSON.parse(output);
    expect(ctx.validPaths).toBeInstanceOf(Array);
    expect(ctx.totalFiles).toBeGreaterThan(0);
  });

  it("analyze produces a report", () => {
    const output = run(`analyze --target ${FIXTURE}`);
    expect(output).toContain("Architecture Analysis Report");
    expect(output).toContain("Total files");
  });

  it("ci-setup generates workflow file", () => {
    const ciRoot = join(TEST_ROOT, "ci-test");
    execSync(`mkdir -p ${ciRoot}`);
    execSync(`node ${archtracker} ci-setup --target src`, {
      cwd: ciRoot,
      encoding: "utf-8",
    });
    expect(existsSync(join(ciRoot, ".github", "workflows", "arch-check.yml"))).toBe(true);
  });
});

// ─── Web Server E2E ──────────────────────────────────────

describe("Web Server E2E", () => {
  let graph: DependencyGraph;
  let viewer: { port: number; close: () => void };
  const PORT = 54321;

  beforeAll(async () => {
    graph = await analyzeProject(FIXTURE);
    viewer = startViewer(graph, { port: PORT, locale: "en" });
  });

  afterAll(() => {
    viewer.close();
  });

  it("serves HTML at /", async () => {
    const res = await fetch(`http://localhost:${PORT}/`);
    expect(res.status).toBe(200);
    expect(res.body).toContain("<!DOCTYPE html>");
    expect(res.body).toContain("Architecture Viewer");
  });

  it("HTML contains graph data", async () => {
    const res = await fetch(`http://localhost:${PORT}/`);
    expect(res.body).toContain('"nodes"');
    expect(res.body).toContain('"links"');
    expect(res.body).toContain("d3.v7");
  });

  it("serves JSON at /api/graph", async () => {
    const res = await fetch(`http://localhost:${PORT}/api/graph`);
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.totalFiles).toBeGreaterThan(0);
    expect(data.edges).toBeInstanceOf(Array);
    expect(data.files).toBeDefined();
  });

  it("includes graph view, hierarchy view, and tabs", async () => {
    const res = await fetch(`http://localhost:${PORT}/`);
    expect(res.body).toContain('id="graph-view"');
    expect(res.body).toContain('id="hier-view"');
    expect(res.body).toContain('data-view="graph-view"');
  });

  it("includes settings panel", async () => {
    const res = await fetch(`http://localhost:${PORT}/`);
    expect(res.body).toContain('id="settings-panel"');
    expect(res.body).toContain("gravity-slider");
    expect(res.body).toContain("font-size-slider");
  });

  it("includes impact simulation button", async () => {
    const res = await fetch(`http://localhost:${PORT}/`);
    expect(res.body).toContain('id="impact-btn"');
    expect(res.body).toContain("toggleImpactMode");
  });

  it("includes export functions", async () => {
    const res = await fetch(`http://localhost:${PORT}/`);
    expect(res.body).toContain("exportSVG");
    expect(res.body).toContain("exportPNG");
  });
});

// ─── Template unit tests ──────────────────────────────────

describe("buildGraphPage", () => {
  let graph: DependencyGraph;

  beforeAll(async () => {
    graph = await analyzeProject(FIXTURE);
  });

  it("returns valid HTML", () => {
    const html = buildGraphPage(graph, { locale: "en" });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });

  it("respects locale option", () => {
    const htmlJa = buildGraphPage(graph, { locale: "ja" });
    expect(htmlJa).toContain("lang=\"ja\"");
    expect(htmlJa).toContain("currentLang = 'ja'");

    const htmlEn = buildGraphPage(graph, { locale: "en" });
    expect(htmlEn).toContain("lang=\"en\"");
  });

  it("includes diff tab when diff data provided", () => {
    const diff = { added: ["new.ts"], removed: [], modified: [], affectedDependents: [] };
    const html = buildGraphPage(graph, { locale: "en", diff });
    expect(html).toContain('id="diff-tab"');
    expect(html).toContain('id="diff-view"');
    expect(html).toContain('"added"');
  });

  it("hides diff tab when no diff data", () => {
    const html = buildGraphPage(graph, { locale: "en" });
    expect(html).toContain("DIFF = null");
  });

  it("extracts project name from rootDir", () => {
    const html = buildGraphPage(graph, { locale: "en" });
    expect(html).toContain("sample-project");
  });

  it("includes esc() XSS escape function with all 5 character replacements", () => {
    const html = buildGraphPage(graph, { locale: "en" });
    expect(html).toContain("function esc(s)");
    // Must handle all 5 dangerous HTML characters
    expect(html).toContain("&amp;");
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
    expect(html).toContain("&quot;");
    expect(html).toContain("&#39;");
  });
});
