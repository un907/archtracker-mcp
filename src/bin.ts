/**
 * Smart entry point for `archtracker-mcp` binary.
 *
 * - If CLI subcommands are detected (serve, analyze, init, etc.) → run CLI
 * - Otherwise → start MCP server on stdio
 *
 * This allows both:
 *   npx archtracker-mcp                          → MCP server
 *   npx archtracker-mcp serve --target src        → Web viewer (CLI mode)
 *   npx archtracker-mcp analyze --target src      → Analysis report (CLI mode)
 */

const CLI_COMMANDS = ["init", "analyze", "check", "context", "serve", "ci-setup", "help"];
const CLI_FLAGS = ["--help", "-h", "--version", "-V"];

const args = process.argv.slice(2);
const hasCommand = args.some((arg) => CLI_COMMANDS.includes(arg));
const hasFlag = args.some((arg) => CLI_FLAGS.includes(arg));

if (hasCommand || hasFlag) {
  await import("./cli/index.js");
} else {
  await import("./mcp/index.js");
}

export {};
