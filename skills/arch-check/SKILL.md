---
name: arch-check
description: Check architecture diff — compare current code against the saved snapshot and report components that may need updates. Use when checking for dependency breakage after code changes.
allowed-tools:
  - mcp__archtracker__check_architecture_diff
  - mcp__archtracker__generate_map
---

## Architecture Diff Check

Run an architecture diff check for the current project.

1. Generate the current dependency map
2. Compare it against the saved snapshot
3. Report any files that have changed and their affected dependents

If no snapshot exists, generate one first and inform the user this is the initial baseline.

Present results in Japanese, clearly listing:
- 変更されたファイル
- 影響を受ける依存ファイル（要確認）
- 推奨アクション
