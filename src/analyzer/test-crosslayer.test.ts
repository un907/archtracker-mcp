import { describe, it, expect } from "vitest";
import { analyzeMultiLayer, detectCrossLayerConnections } from "./multi-layer.js";
import { loadLayerConfig } from "../storage/layers.js";

describe("cross-layer auto-detection", () => {
  it("detects connections in 13-layer test fixture", async () => {
    const root = "/tmp/multi-layer-visual-test";
    const config = await loadLayerConfig(root);
    if (!config) throw new Error("No layers.json found");

    const multi = await analyzeMultiLayer(root, config.layers);
    const auto = detectCrossLayerConnections(multi.layers, config.layers);

    console.log(`Auto-detected ${auto.length} cross-layer connections:`);
    for (const c of auto) {
      console.log(`  ${c.fromLayer}/${c.fromFile} → ${c.toLayer}/${c.toFile} [${c.label}]`);
    }

    // Should detect at least some connections
    expect(auto.length).toBeGreaterThan(0);
  });
});
