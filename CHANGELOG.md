# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-03-06

### Fixed

- **Comment stripping**: Import extraction now correctly ignores commented-out imports across all languages (C-style `//`/`/* */`, Python `#`/`"""`/`'''`, Ruby `#`/`=begin`/`=end`, PHP `//`/`#`/`/* */`)
- **Rust grouped use**: Properly handles `use crate::{foo, bar::baz}` syntax, expanding grouped imports into individual paths
- **Go import blocks**: Rewrote Go import parser to correctly handle `import (...)` blocks without false positives from non-import contexts
- **Go ESM compatibility**: Replaced `require("node:fs")` with proper ESM `readFileSync` import
- **Edge deduplication**: Multiple imports resolving to the same target no longer produce duplicate edges
- **Self-import prevention**: Files cannot create edges to themselves

### Changed

- **Test suite expanded**: 160 tests (74 new), with exact edge assertions verifying specific source→target pairs, comment stripping correctness, and graph integrity across all 9 languages
- **LanguageConfig extended**: Added `commentStyle` and optional `extractImports` for languages with complex syntax

## [0.2.0] - 2026-03-06

### Added

- **Multi-language support**: Dependency analysis for 10 languages
  - JavaScript/TypeScript (via dependency-cruiser, unchanged)
  - Python (`from/import` statements, relative imports, `__init__.py` resolution)
  - Rust (`use crate::`, `mod` declarations, `mod.rs` resolution)
  - Go (`import` with `go.mod` module prefix stripping)
  - Java (`import` with `src/main/java/` resolution)
  - C/C++ (`#include "..."` with source-relative and include-dir resolution)
  - Ruby (`require_relative`, `require` with `lib/` fallback)
  - PHP (`require/include`, PSR-4 `use` namespace resolution)
  - Swift (`import` with SPM `Sources/` convention)
  - Kotlin (`import` with Gradle source root resolution)
- **Language auto-detection**: Marker file detection (Cargo.toml, go.mod, pyproject.toml, etc.) with extension frequency fallback
- **Pluggable engine architecture**: `AnalyzerEngine` interface with `DependencyCruiserEngine` (JS/TS) and `RegexEngine` (all others)
- **DFS cycle detection**: Custom circular dependency detection for non-JS/TS languages
- **`language` parameter**: All MCP tools and `analyzeProject()` accept optional `language` override
- **Test suite expanded**: 86 tests (32 new multi-language tests)

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

[0.2.1]: https://github.com/un907/archtracker-mcp/releases/tag/v0.2.1
[0.2.0]: https://github.com/un907/archtracker-mcp/releases/tag/v0.2.0
[0.1.1]: https://github.com/un907/archtracker-mcp/releases/tag/v0.1.1
[0.1.0]: https://github.com/un907/archtracker-mcp/releases/tag/v0.1.0
