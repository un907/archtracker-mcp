---
name: arch-analyze
description: Analyze existing architecture — comprehensive report of an existing project's dependency structure, critical components, circular deps, orphan files, and coupling hotspots. Use when introducing archtracker to an existing project or when you need a full architectural overview.
argument-hint: "[target directory, e.g. src]"
allowed-tools:
  - mcp__archtracker__analyze_existing_architecture
  - mcp__archtracker__save_architecture_snapshot
---

## Architecture Analysis

Perform a comprehensive architecture analysis of the project.

1. Run `analyze_existing_architecture` on the target directory
2. Present the full report covering:
   - Overview (file count, edge count, circular deps)
   - Critical components (most depended-on files)
   - Circular dependency details
   - High coupling files (most imports)
   - Orphan files (isolated, no connections)
   - Directory breakdown
3. Offer to save a snapshot if one doesn't exist yet

Present results clearly, highlighting:
- Architectural risks (circular deps, high coupling)
- Key files that many components depend on
- Orphan files that may be dead code
- Recommendations for improvement
