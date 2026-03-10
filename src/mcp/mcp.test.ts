/**
 * MCP server integration tests — security & schema validation
 *
 * Spawns the actual MCP server as a subprocess and verifies:
 * - Path traversal is rejected on all tools (H1, H2 fixes)
 * - Removed parameters (maxDepth) are not accepted (H3 fix)
 * - Tool descriptions are consistent (M4 fix)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join } from "node:path";

const MCP_SERVER = join(import.meta.dirname, "..", "..", "dist", "mcp", "index.js");

describe("MCP server integration", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: "node",
      args: [MCP_SERVER],
      stderr: "pipe",
    });
    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(transport);
  }, 15000);

  afterAll(async () => {
    await client.close();
  });

  // ═══════════════════════════════════════════════════════
  // Tool listing & schema validation
  // ═══════════════════════════════════════════════════════

  describe("tool listing", () => {
    it("exposes all 6 tools", async () => {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name).sort();
      expect(names).toEqual([
        "analyze_existing_architecture",
        "check_architecture_diff",
        "generate_map",
        "get_current_context",
        "save_architecture_snapshot",
        "search_architecture",
      ]);
    });

    it("generate_map does NOT have maxDepth parameter (H3)", async () => {
      const { tools } = await client.listTools();
      const generateMap = tools.find((t) => t.name === "generate_map");
      expect(generateMap).toBeDefined();
      const schema = generateMap!.inputSchema as { properties?: Record<string, unknown> };
      expect(schema.properties).toBeDefined();
      expect(schema.properties!["maxDepth"]).toBeUndefined();
    });

    it("analyze_existing_architecture description uses language names, not count (M4)", async () => {
      const { tools } = await client.listTools();
      const analyze = tools.find((t) => t.name === "analyze_existing_architecture");
      expect(analyze).toBeDefined();
      // Should contain actual language names (e.g. "Python"), not just "13 languages"
      expect(analyze!.description).toContain("Python");
      expect(analyze!.description).toContain("Rust");
      expect(analyze!.description).not.toMatch(/\d+ languages/);
    });
  });

  // ═══════════════════════════════════════════════════════
  // Path traversal protection on all 6 tools
  // ═══════════════════════════════════════════════════════

  describe("path traversal protection", () => {
    const TRAVERSAL_PATH = "../../../etc";

    async function callTool(name: string, args: Record<string, unknown>) {
      return client.callTool({ name, arguments: args });
    }

    it("generate_map rejects traversal on targetDir", async () => {
      const result = await callTool("generate_map", {
        targetDir: TRAVERSAL_PATH,
        projectRoot: ".",
      });
      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ text: string }>)[0].text;
      expect(text.toLowerCase()).toMatch(/path.*traversal|security/i);
    });

    it("generate_map rejects traversal on projectRoot", async () => {
      const result = await callTool("generate_map", {
        targetDir: "src",
        projectRoot: TRAVERSAL_PATH,
      });
      expect(result.isError).toBe(true);
    });

    it("analyze_existing_architecture rejects traversal on projectRoot even without saveSnapshot (H2)", async () => {
      const result = await callTool("analyze_existing_architecture", {
        targetDir: "src",
        projectRoot: TRAVERSAL_PATH,
        saveSnapshot: false,
      });
      expect(result.isError).toBe(true);
    });

    it("analyze_existing_architecture rejects traversal on targetDir", async () => {
      const result = await callTool("analyze_existing_architecture", {
        targetDir: TRAVERSAL_PATH,
        projectRoot: ".",
      });
      expect(result.isError).toBe(true);
    });

    it("save_architecture_snapshot rejects traversal on targetDir", async () => {
      const result = await callTool("save_architecture_snapshot", {
        targetDir: TRAVERSAL_PATH,
        projectRoot: ".",
      });
      expect(result.isError).toBe(true);
    });

    it("save_architecture_snapshot rejects traversal on projectRoot", async () => {
      const result = await callTool("save_architecture_snapshot", {
        targetDir: "src",
        projectRoot: TRAVERSAL_PATH,
      });
      expect(result.isError).toBe(true);
    });

    it("check_architecture_diff rejects traversal on targetDir", async () => {
      const result = await callTool("check_architecture_diff", {
        targetDir: TRAVERSAL_PATH,
        projectRoot: ".",
      });
      expect(result.isError).toBe(true);
    });

    it("check_architecture_diff rejects traversal on projectRoot", async () => {
      const result = await callTool("check_architecture_diff", {
        targetDir: "src",
        projectRoot: TRAVERSAL_PATH,
      });
      expect(result.isError).toBe(true);
    });

    it("get_current_context rejects traversal on targetDir (H1)", async () => {
      const result = await callTool("get_current_context", {
        targetDir: TRAVERSAL_PATH,
        projectRoot: ".",
      });
      expect(result.isError).toBe(true);
    });

    it("get_current_context rejects traversal on projectRoot (H1)", async () => {
      const result = await callTool("get_current_context", {
        targetDir: "src",
        projectRoot: TRAVERSAL_PATH,
      });
      expect(result.isError).toBe(true);
    });

    it("search_architecture rejects traversal on targetDir", async () => {
      const result = await callTool("search_architecture", {
        query: "test",
        mode: "path",
        targetDir: TRAVERSAL_PATH,
        projectRoot: ".",
      });
      expect(result.isError).toBe(true);
    });

    it("search_architecture rejects traversal on projectRoot", async () => {
      const result = await callTool("search_architecture", {
        query: "test",
        mode: "path",
        targetDir: "src",
        projectRoot: TRAVERSAL_PATH,
      });
      expect(result.isError).toBe(true);
    });
  });
});
