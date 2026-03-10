---
name: arch-search
description: Search the architecture for files, impact analysis, critical components, or orphans. Works across all layers in multi-layer projects. Use when asking about dependencies, impact of changes, or finding important files.
argument-hint: [query]
allowed-tools:
  - mcp__archtracker__search_architecture
---

## Architecture Search

Search the project architecture using $ARGUMENTS.

Available search modes:
- **path**: Find files matching a pattern (default). In multi-layer projects, paths are prefixed with layer name (e.g. `Backend/worker.py`)
- **affected**: Find all files affected if a specific file changes (including cross-layer impact)
- **critical**: Find the most important files (most depended-on)
- **orphans**: Find isolated files with no connections

Choose the most appropriate mode based on the user's question and execute the search.

Optional parameters:
- `limit`: Max number of results to return (default: 10, max: 50)
- `language`: Target language if auto-detection is insufficient (e.g. `python`, `rust`, `java`)

Present results in the user's language with clear formatting:
- File paths and dependency counts
- Match reason
- Recommended actions (for impact analysis)
