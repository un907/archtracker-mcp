# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-03-06

### Fixed

- **Windows + Node.js v22 compatibility**: Patched dependency-cruiser's CJS subpath imports (`#utl/try-require.cjs`) that fail to resolve on Windows with Node.js v22+ via postinstall script

## [0.1.0] - 2025-03-05

### Added

- **MCP Server** with 5 tools: `generate_map`, `save_architecture_snapshot`, `check_architecture_diff`, `get_current_context`, `search_architecture`
- **CLI** with 6 commands: `init`, `analyze`, `check`, `context`, `serve`, `ci-setup`
- **Interactive Web Viewer** with 3 views:
  - Force-directed graph view with click-to-pin, impact simulation, directory filters
  - Hierarchy view (DAG layout) with click-to-pin and detail panel
  - Diff view with color-coded change visualization
- **Settings panel**: theme (dark/light), font size, node size, link opacity, gravity, language, SVG/PNG export
- **Settings persistence** via localStorage with 2-phase restore
- **Snapshot management**: save, load, and diff architecture snapshots
- **Impact simulation**: BFS traversal to visualize transitive dependents
- **Claude Code Skills**: 5 slash commands for AI-driven workflows
- **i18n**: Full English and Japanese support (90+ message keys)
- **CI integration**: `--ci` mode and `ci-setup` command for GitHub Actions
- **Watch mode**: `--watch` flag for auto-reload on file changes
- **Programmatic API**: `analyzeProject`, `saveSnapshot`, `loadSnapshot`, `computeDiff`, `formatDiffReport`, `formatAnalysisReport`
- **Security**: Path traversal protection for all file operations
- **Test suite**: 54 tests (unit + E2E) with Vitest

[0.1.1]: https://github.com/un907/archtracker-mcp/releases/tag/v0.1.1
[0.1.0]: https://github.com/un907/archtracker-mcp/releases/tag/v0.1.0
