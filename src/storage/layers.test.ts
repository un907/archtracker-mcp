import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadLayerConfig, saveLayerConfig } from "./layers.js";

describe("Layer config", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "layers-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should return null when no layers.json exists", async () => {
    const result = await loadLayerConfig(tempDir);
    expect(result).toBeNull();
  });

  it("should load a valid layers.json", async () => {
    const config = {
      version: "1.0",
      layers: [
        { name: "Frontend", targetDir: "frontend/src", language: "c-sharp" },
        { name: "Backend", targetDir: "backend", language: "python" },
      ],
    };
    await mkdir(join(tempDir, ".archtracker"), { recursive: true });
    await writeFile(
      join(tempDir, ".archtracker", "layers.json"),
      JSON.stringify(config),
    );

    const result = await loadLayerConfig(tempDir);
    expect(result).not.toBeNull();
    expect(result!.layers).toHaveLength(2);
    expect(result!.layers[0].name).toBe("Frontend");
    expect(result!.layers[1].language).toBe("python");
  });

  it("should reject duplicate layer names", async () => {
    const config = {
      version: "1.0",
      layers: [
        { name: "Same", targetDir: "a" },
        { name: "Same", targetDir: "b" },
      ],
    };
    await mkdir(join(tempDir, ".archtracker"), { recursive: true });
    await writeFile(
      join(tempDir, ".archtracker", "layers.json"),
      JSON.stringify(config),
    );

    await expect(loadLayerConfig(tempDir)).rejects.toThrow(
      "Layer names must be unique",
    );
  });

  it("should reject invalid layer name characters", async () => {
    const config = {
      version: "1.0",
      layers: [{ name: "Has Space", targetDir: "a" }],
    };
    await mkdir(join(tempDir, ".archtracker"), { recursive: true });
    await writeFile(
      join(tempDir, ".archtracker", "layers.json"),
      JSON.stringify(config),
    );

    await expect(loadLayerConfig(tempDir)).rejects.toThrow("alphanumeric");
  });

  it("should reject empty layers array", async () => {
    const config = { version: "1.0", layers: [] };
    await mkdir(join(tempDir, ".archtracker"), { recursive: true });
    await writeFile(
      join(tempDir, ".archtracker", "layers.json"),
      JSON.stringify(config),
    );

    await expect(loadLayerConfig(tempDir)).rejects.toThrow("validation failed");
  });

  it("should accept optional fields", async () => {
    const config = {
      version: "1.0",
      layers: [
        {
          name: "Web",
          targetDir: "web/src",
          color: "#58a6ff",
          description: "React Dashboard",
          exclude: ["test"],
        },
      ],
    };
    await mkdir(join(tempDir, ".archtracker"), { recursive: true });
    await writeFile(
      join(tempDir, ".archtracker", "layers.json"),
      JSON.stringify(config),
    );

    const result = await loadLayerConfig(tempDir);
    expect(result!.layers[0].color).toBe("#58a6ff");
    expect(result!.layers[0].description).toBe("React Dashboard");
    expect(result!.layers[0].exclude).toEqual(["test"]);
  });

  it("should preserve connections field (forward compat)", async () => {
    const config = {
      version: "1.0",
      layers: [{ name: "A", targetDir: "a" }],
      connections: [
        {
          fromLayer: "A",
          fromFile: "x.py",
          toLayer: "B",
          toFile: "y.cs",
          type: "api-call",
          label: "REST",
        },
      ],
    };
    await mkdir(join(tempDir, ".archtracker"), { recursive: true });
    await writeFile(
      join(tempDir, ".archtracker", "layers.json"),
      JSON.stringify(config),
    );

    const result = await loadLayerConfig(tempDir);
    expect(result!.connections).toHaveLength(1);
    expect(result!.connections![0].type).toBe("api-call");
  });

  it("should save and reload a config", async () => {
    const config = {
      version: "1.0" as const,
      layers: [
        { name: "App", targetDir: "src" },
        { name: "Lib", targetDir: "lib", language: "rust" as const },
      ],
    };

    await saveLayerConfig(tempDir, config);

    const raw = await readFile(
      join(tempDir, ".archtracker", "layers.json"),
      "utf-8",
    );
    expect(JSON.parse(raw)).toEqual(config);

    const loaded = await loadLayerConfig(tempDir);
    expect(loaded).toEqual(config);
  });

  it("should reject invalid JSON", async () => {
    await mkdir(join(tempDir, ".archtracker"), { recursive: true });
    await writeFile(
      join(tempDir, ".archtracker", "layers.json"),
      "not json {{{",
    );

    await expect(loadLayerConfig(tempDir)).rejects.toThrow("Invalid JSON");
  });
});
