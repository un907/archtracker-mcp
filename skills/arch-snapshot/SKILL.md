---
name: arch-snapshot
description: Save the current architecture state as a snapshot baseline. Auto-detects multi-layer projects (layers.json). Use when the current code state is confirmed good and should be the new baseline for diff checks.
allowed-tools:
  - mcp__archtracker__generate_map
  - mcp__archtracker__save_architecture_snapshot
---

## Save Architecture Snapshot

Save the current project architecture as the baseline snapshot.

1. Run `save_architecture_snapshot`
   - For multi-layer projects: set `projectRoot` to the project root where `.archtracker/layers.json` exists
   - Leave `targetDir` as default `"src"` to trigger multi-layer auto-detection
2. Save it as `.archtracker/snapshot.json`
3. Confirm the save with a summary

Present results in the user's language:
- Saved file count and edge count
- Key components (top 5 most depended-on files)
- Snapshot timestamp
- Layer breakdown (if multi-layer project)
