import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { analyzeMultiLayer } from "./multi-layer.js";

const FIXTURES = join(import.meta.dirname, "__fixtures__");
const MULTI = join(FIXTURES, "multi-layer-project");

describe("Multi-layer analysis", () => {
  it("should analyze multiple layers and merge graphs", async () => {
    const result = await analyzeMultiLayer(MULTI, [
      { name: "Frontend", targetDir: "frontend", language: "javascript" },
      { name: "Backend", targetDir: "backend", language: "python" },
    ]);

    // Individual layers exist
    expect(result.layers["Frontend"]).toBeDefined();
    expect(result.layers["Backend"]).toBeDefined();

    // Metadata
    expect(result.layerMetadata).toHaveLength(2);
    expect(result.layerMetadata[0].name).toBe("Frontend");
    expect(result.layerMetadata[1].name).toBe("Backend");
  });

  it("should prefix merged graph paths with layer names", async () => {
    const result = await analyzeMultiLayer(MULTI, [
      { name: "Frontend", targetDir: "frontend", language: "javascript" },
      { name: "Backend", targetDir: "backend", language: "python" },
    ]);

    const files = Object.keys(result.merged.files);
    // Frontend files are prefixed
    expect(files).toContain("Frontend/App.ts");
    expect(files).toContain("Frontend/api.ts");
    expect(files).toContain("Frontend/Button.ts");
    // Backend files are prefixed
    expect(files).toContain("Backend/server.py");
    expect(files).toContain("Backend/routes.py");
    expect(files).toContain("Backend/db.py");
  });

  it("should prefix edges in merged graph", async () => {
    const result = await analyzeMultiLayer(MULTI, [
      { name: "Frontend", targetDir: "frontend", language: "javascript" },
      { name: "Backend", targetDir: "backend", language: "python" },
    ]);

    // App.ts imports api.ts and Button.ts
    const appEdges = result.merged.edges.filter(
      (e) => e.source === "Frontend/App.ts",
    );
    expect(appEdges.length).toBeGreaterThanOrEqual(2);
    expect(appEdges.some((e) => e.target === "Frontend/api.ts")).toBe(true);
    expect(appEdges.some((e) => e.target === "Frontend/Button.ts")).toBe(true);

    // server.py imports routes.py and db.py
    const serverEdges = result.merged.edges.filter(
      (e) => e.source === "Backend/server.py",
    );
    expect(serverEdges.length).toBeGreaterThanOrEqual(2);
    expect(serverEdges.some((e) => e.target === "Backend/routes.py")).toBe(true);
    expect(serverEdges.some((e) => e.target === "Backend/db.py")).toBe(true);
  });

  it("should compute correct totals", async () => {
    const result = await analyzeMultiLayer(MULTI, [
      { name: "Frontend", targetDir: "frontend", language: "javascript" },
      { name: "Backend", targetDir: "backend", language: "python" },
    ]);

    const frontendFiles = result.layers["Frontend"].totalFiles;
    const backendFiles = result.layers["Backend"].totalFiles;
    expect(result.merged.totalFiles).toBe(frontendFiles + backendFiles);

    const frontendEdges = result.layers["Frontend"].totalEdges;
    const backendEdges = result.layers["Backend"].totalEdges;
    expect(result.merged.totalEdges).toBe(frontendEdges + backendEdges);
  });

  it("should assign colors from config or default palette", async () => {
    const result = await analyzeMultiLayer(MULTI, [
      {
        name: "Frontend",
        targetDir: "frontend",
        language: "javascript",
        color: "#ff0000",
      },
      { name: "Backend", targetDir: "backend", language: "python" },
    ]);

    expect(result.layerMetadata[0].color).toBe("#ff0000");
    // Default palette color for index 1
    expect(result.layerMetadata[1].color).toBe("#3fb950");
  });

  it("should keep individual layer graphs un-prefixed", async () => {
    const result = await analyzeMultiLayer(MULTI, [
      { name: "Frontend", targetDir: "frontend", language: "javascript" },
    ]);

    const files = Object.keys(result.layers["Frontend"].files);
    expect(files).toContain("App.ts");
    expect(files).not.toContain("Frontend/App.ts");
  });

  it("should handle no cross-layer edges", async () => {
    const result = await analyzeMultiLayer(MULTI, [
      { name: "Frontend", targetDir: "frontend", language: "javascript" },
      { name: "Backend", targetDir: "backend", language: "python" },
    ]);

    // No edge should cross layers
    for (const edge of result.merged.edges) {
      const sourceLayer = edge.source.split("/")[0];
      const targetLayer = edge.target.split("/")[0];
      expect(sourceLayer).toBe(targetLayer);
    }
  });
});
