import { defineConfig } from "tsup";

export default defineConfig([
  // Smart entry point (archtracker-mcp bin — CLI or MCP depending on args)
  {
    entry: { bin: "src/bin.ts" },
    format: ["esm"],
    target: "node18",
    outDir: "dist",
    dts: false,
    sourcemap: true,
    clean: true,
    noExternal: [],
    banner: {
      js: "#!/usr/bin/env node",
    },
    esbuildOptions(options) {
      options.external = ["./cli/index.js", "./mcp/index.js"];
    },
  },
  // MCP Server entry (also used as direct import)
  {
    entry: { "mcp/index": "src/mcp/index.ts" },
    format: ["esm"],
    target: "node18",
    outDir: "dist",
    dts: true,
    sourcemap: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  // CLI entry (with shebang)
  {
    entry: { "cli/index": "src/cli/index.ts" },
    format: ["esm"],
    target: "node18",
    outDir: "dist",
    dts: false,
    sourcemap: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  // Library exports (analyzer, storage)
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    target: "node18",
    outDir: "dist",
    dts: true,
    sourcemap: true,
  },
]);
