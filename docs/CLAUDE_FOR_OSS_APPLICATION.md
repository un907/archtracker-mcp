# Claude for OSS Application — archtracker-mcp

> Application draft for https://claude.com/contact-sales/claude-for-oss

---

## Project Information

**Project Name:** archtracker-mcp

**Repository:** https://github.com/un907/archtracker-mcp

**npm Package:** https://www.npmjs.com/package/archtracker-mcp

**License:** MIT

**Maintainer:** un907

---

## What is archtracker-mcp?

archtracker-mcp is an **Architecture & Dependency Tracker** built specifically for AI-driven development workflows. It provides an MCP (Model Context Protocol) server, CLI, interactive web viewer, and Claude Code Skills that enable AI agents to understand, track, and protect software architecture.

### The Problem It Solves

When AI agents (including Claude) modify code, they frequently miss cascading impacts — changing `auth.ts` without knowing 12 files depend on it, referencing stale file paths from previous sessions, or introducing architectural drift that goes unnoticed until production.

archtracker-mcp solves this by providing:
- **Real-time dependency analysis** (AST-based static analysis)
- **Architecture snapshot diffing** (detect drift between sessions)
- **Impact simulation** (visualize transitive dependents)
- **MCP integration** (5 tools that give AI agents architectural awareness)

### Why This Matters for the AI Development Ecosystem

This is **infrastructure for AI-safe code modification**. As AI agents become primary code authors, the gap between "what the AI changed" and "what else needs to change" is the #1 source of bugs in AI-driven development. archtracker-mcp closes that gap.

---

## How It Uses Claude / Anthropic Products

archtracker-mcp is deeply integrated with the Claude ecosystem:

1. **MCP Server** — Implements Model Context Protocol with 5 tools (`generate_map`, `save_architecture_snapshot`, `check_architecture_diff`, `get_current_context`, `search_architecture`) that Claude Code can call natively

2. **Claude Code Skills** — Ships 5 slash commands (`/arch-analyze`, `/arch-check`, `/arch-snapshot`, `/arch-context`, `/arch-search`) that integrate directly into Claude Code workflows

3. **Built WITH Claude** — The entire project was architected and implemented using Claude Code (Claude Opus), demonstrating Claude's capability for complex OSS development

4. **Designed FOR Claude** — Every feature is designed to make AI agents (especially Claude) better at code modification by providing architectural context they currently lack

---

## Technical Highlights

| Feature | Description |
|---------|-------------|
| MCP Server | 5 tools, Zod-validated inputs, stdio transport |
| CLI | 6 commands (init, analyze, check, context, serve, ci-setup) |
| Web Viewer | 3 views (force-directed graph, DAG hierarchy, diff), D3.js |
| Impact Simulation | BFS traversal of reverse dependency graph |
| Snapshot Diffing | Detect added/removed/modified files + affected dependents |
| i18n | Full English + Japanese support (90+ message keys) |
| CI Integration | --ci mode + auto-generated GitHub Actions workflow |
| Test Suite | 54 tests (unit + E2E) with Vitest |
| Security | Path traversal protection on all file operations |

**Zero runtime dependencies beyond:**
- `@modelcontextprotocol/sdk` (MCP protocol)
- `commander` (CLI)
- `dependency-cruiser` (AST analysis)
- `zod` (input validation)

---

## Why This is a Blue Ocean

There is currently **no established tool** that provides:
- MCP-native architecture tracking for AI agents
- Snapshot-based architecture drift detection
- Interactive dependency visualization with impact simulation
- Claude Code Skills for architecture workflows

Existing tools (Madge, dependency-cruiser CLI, etc.) are designed for human developers running one-off commands. archtracker-mcp is designed for **continuous AI-agent integration** — it gives AI agents the architectural awareness they fundamentally lack.

### Target Users
- Any developer using Claude Code or MCP-compatible AI agents
- Teams where AI agents are primary code authors
- Projects where architectural integrity matters (monorepos, microservices, shared libraries)

---

## Growth Strategy

1. **npm publish** — Global install + npx one-liner for zero-friction adoption
2. **MCP ecosystem** — Listed in MCP server directories and Claude Code plugin registries
3. **Multi-language docs** — English + Japanese (tapping into Japan's growing AI dev community)
4. **Content** — Blog posts, demo videos showing real-world impact on AI-driven development
5. **CI/CD integration** — GitHub Actions workflow generation makes adoption permanent
6. **Community** — Issue templates, contributing guide, bilingual support

---

## Recent Activity (Evidence of Active Maintenance)

- **11 commits** on main branch (active development)
- **v0.1.0** released (initial public release)
- **54 tests** passing (comprehensive test coverage)
- **GitHub Actions CI** configured (Node 18/20/22 matrix)
- **Continuous development** — features being added weekly

---

## Application Text (Copy-Paste Ready)

### Short Description
> archtracker-mcp is an Architecture & Dependency Tracker that provides MCP tools, CLI, and an interactive web viewer for AI-driven development. It gives AI agents (especially Claude) the architectural awareness they need to avoid cascading bugs when modifying code.

### Why I Should Be Accepted
> I'm building critical infrastructure for AI-safe code modification. archtracker-mcp is the first tool that provides MCP-native architecture tracking — giving Claude Code real-time dependency analysis, snapshot diffing, and impact simulation. The entire project was built with Claude and designed for Claude. As AI agents become primary code authors, this tool prevents the #1 category of AI-introduced bugs: missed cascading impacts. It's open-source (MIT), bilingual (EN/JA), and fills a gap that no other tool addresses.

### What I Maintain
> archtracker-mcp — an MCP server + CLI + web viewer for architecture tracking in AI-driven development. I'm the sole maintainer and creator. The project includes 5 MCP tools, 6 CLI commands, an interactive D3.js web viewer, 5 Claude Code Skills, full i18n (EN/JA), and 54 tests. Built entirely with Claude Code.
