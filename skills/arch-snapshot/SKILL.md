---
name: arch-snapshot
description: Save the current architecture state as a snapshot. Use when the current code state is confirmed good and should be the new baseline.
allowed-tools:
  - mcp__archtracker__generate_map
  - mcp__archtracker__save_architecture_snapshot
---

## Save Architecture Snapshot

Save the current project architecture as the baseline snapshot.

1. Generate the current dependency map
2. Save it as `.archtracker/snapshot.json`
3. Confirm the save with a summary

Present results in Japanese:
- 保存されたファイル数とエッジ数
- 主要コンポーネント（依存が多いファイルのトップ5）
- スナップショットのタイムスタンプ
