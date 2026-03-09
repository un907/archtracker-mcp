---
name: arch-check
description: Check architecture diff — compare current code against the saved snapshot and report components that may need updates. Auto-detects multi-layer projects. Use when checking for dependency breakage after code changes.
allowed-tools:
  - mcp__archtracker__check_architecture_diff
  - mcp__archtracker__generate_map
---

## Architecture Diff Check

Run an architecture diff check for the current project.

1. Run `check_architecture_diff`
   - For multi-layer projects: set `projectRoot` to the project root where `.archtracker/layers.json` exists
   - Leave `targetDir` as default `"src"` to trigger multi-layer auto-detection
2. Compare current code against the saved snapshot
3. Report any files that have changed and their affected dependents

If no snapshot exists, one is auto-generated as the initial baseline.

Present results in the user's language, clearly listing:
- Changed files (added, removed, modified edges)
- Affected dependent files that may need updates
- Cross-layer impact (if multi-layer project)
- Recommended actions
