---
name: arch-analyze
description: Analyze existing architecture — comprehensive report of dependency structure, critical components, circular deps, orphan files, and coupling hotspots. Auto-detects multi-layer projects (layers.json). Use when introducing archtracker or when you need a full architectural overview.
argument-hint: "[target directory, e.g. src]"
allowed-tools:
  - mcp__archtracker__analyze_existing_architecture
  - mcp__archtracker__save_architecture_snapshot
---

## Architecture Analysis

Perform a comprehensive architecture analysis of the project.

1. Run `analyze_existing_architecture` on the target directory
   - For multi-layer projects: set `projectRoot` to the project root where `.archtracker/layers.json` exists, and leave `targetDir` as default `"src"` to trigger auto-detection
   - For single-directory projects: set `targetDir` to the source directory
   - Optional `topN` parameter to control number of items per section (default: 10, max: 50)
   - Optional `language` parameter to specify target language (e.g. `python`, `rust`) if auto-detection fails
2. Present the full report covering:
   - Overview (file count, edge count, circular deps)
   - Critical components (most depended-on files)
   - Circular dependency details
   - High coupling files (most imports)
   - Orphan files (isolated, no connections)
   - Directory breakdown
   - **Multi-layer info** (if detected): layer summary, cross-layer connections
3. Offer to save a snapshot if one doesn't exist yet

Present results in the user's language, highlighting:
- Architectural risks (circular deps, high coupling)
- Key files that many components depend on
- Orphan files that may be dead code
- Cross-layer dependencies (if multi-layer)
- Recommendations for improvement
