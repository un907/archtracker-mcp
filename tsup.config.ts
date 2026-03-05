import { defineConfig } from "tsup";

export default defineConfig([
  // MCP Server entry
  {
    entry: { "mcp/index": "src/mcp/index.ts" },
    format: ["esm"],
    target: "node18",
    outDir: "dist",
    dts: true,
    sourcemap: true,
    clean: true,
    banner: {},
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
