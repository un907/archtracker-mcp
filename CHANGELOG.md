# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-03-06

### Removed

- **dependency-cruiser**: Completely removed as a dependency — JS/TS analysis now uses the same RegexEngine as all other languages
- **typescript peerDependency**: No longer required; `npm install` works without TypeScript installed
- **postinstall script**: No longer needed (was patching dependency-cruiser for Windows + Node.js v22)

### Added

- **JS/TS RegexEngine**: Native regex-based import extraction for JavaScript/TypeScript
  - ES6 imports (`import { foo } from "./bar"`)
  - Dynamic imports (`import("./foo")`)
  - Re-exports (`export { foo } from "./bar"`)
  - CommonJS requires (`require("./foo")`)
  - ESM convention support (`.js` → `.ts` resolution)
  - Index file resolution (`./dir` → `./dir/index.ts`)
- **`--language` CLI option**: All analysis commands accept `-l, --language <lang>` to override auto-detection
- **Robustness test suite**: 84 new tests covering post-installation scenarios
  - CLI validation (invalid language, nonexistent directories, path traversal)
  - Analyzer edge cases (malformed files, unicode paths, mixed-language projects, deep nesting)
  - Storage resilience (corrupted JSON, wrong schema, large graphs)
  - Package integrity (exports, bin, no unnecessary dependencies)

### Changed

- **Unified engine architecture**: All 13 languages now use `RegexEngine` — no more `DependencyCruiserEngine` special case
- **Zero external runtime dependencies for analysis**: Only `commander` (CLI) and `zod` (validation) remain as production dependencies
- **Package size reduced**: ~25 MB installed (previously ~80 MB with dependency-cruiser + TypeScript)
- **Test performance**: Full suite runs in ~1s (previously ~2.6s)
- **Test suite expanded**: 378+ tests total

## [0.3.2] - 2026-03-06

### Changed

- **Single source of truth**: Version string now read from `package.json` at runtime (no more hardcoded version in MCP server or CLI)
- **Single source of truth**: Language ID list (`LANGUAGE_IDS`) defined once in `types.ts`, used by MCP tool schemas, descriptions, and language count — adding a language never requires touching multiple files
- **Single source of truth**: MCP tool descriptions auto-generate language list and count from `LANGUAGE_IDS`

## [0.3.1] - 2026-03-06

### Fixed

- **Version strings**: MCP server and CLI version now correctly report `0.3.1`
- **Tool descriptions**: `generate_map` and `analyze_existing_architecture` now list all 13 supported languages

## [0.3.0] - 2026-03-06

### Added

- **3 new languages**: C#, Dart, Scala — total **13 languages** supported
  - C# (`using Namespace;`, `using static`, namespace-to-directory resolution, `.sln`/`.csproj` detection)
  - Dart (`import 'package:...'`, relative imports, `pubspec.yaml` package name resolution, `dart:` stdlib skip)
  - Scala (`import pkg.Class`, grouped `import pkg.{A, B}`, wildcard `._` skip, `build.sbt`/`build.sc` detection)
- **Extension-based marker detection**: Languages without fixed-name markers (e.g. C# `.sln`) detected via file extension scan

### Fixed

- **C-style char literals**: `'/'` no longer triggers false comment detection
- **Rust raw strings**: `r"..."`, `r#"..."#`, `r##"..."##` content correctly stripped
- **Ruby `=begin`/`=end`**: Strict line-start matching (no false match on `=beginning`)
- **Ruby `#{}` interpolation**: String interpolation with nested braces handled correctly
- **PHP heredoc/nowdoc**: `<<<EOT` and `<<<'EOT'` block content correctly stripped
- **Python string prefixes**: `r""`, `f""`, `b""`, `rb""`, `fr""` (case-insensitive) handled correctly
- **Python multi-import**: `import a, b, c` now resolves all modules
- **Rust `use super::`/`use self::`**: Relative module imports now resolved correctly
- **Java wildcard imports**: `import com.example.*` correctly returns null (no false edge)
- **Java static imports**: `import static com.example.Class.method` resolves to class file via progressive shortening
- **Kotlin wildcard imports**: `import com.example.*` correctly returns null
- **PHP `use function`/`use const`**: Keywords stripped before namespace resolution
- **Swift `@testable import`**: Correctly recognized as valid import
- **Regex engine infinite loop**: All import regex patterns now force `g` flag

### Changed

- **Test suite expanded**: 293 tests (133 new), covering comment stripping edge cases, maxDepth/exclude options, empty/single-file projects, language auto-detection, dependencies/dependents cross-checks for all 13 languages

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

[0.4.0]: https://github.com/un907/archtracker-mcp/releases/tag/v0.4.0
[0.3.2]: https://github.com/un907/archtracker-mcp/releases/tag/v0.3.2
[0.3.1]: https://github.com/un907/archtracker-mcp/releases/tag/v0.3.1
[0.3.0]: https://github.com/un907/archtracker-mcp/releases/tag/v0.3.0
[0.2.1]: https://github.com/un907/archtracker-mcp/releases/tag/v0.2.1
[0.2.0]: https://github.com/un907/archtracker-mcp/releases/tag/v0.2.0
[0.1.1]: https://github.com/un907/archtracker-mcp/releases/tag/v0.1.1
[0.1.0]: https://github.com/un907/archtracker-mcp/releases/tag/v0.1.0
