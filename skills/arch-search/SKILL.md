---
name: arch-search
description: Search the architecture for files, impact analysis, critical components, or orphans. Use when asking about dependencies, impact of changes, or finding important files.
argument-hint: [query]
allowed-tools:
  - mcp__archtracker__search_architecture
---

## Architecture Search

Search the project architecture using $ARGUMENTS.

Available search modes:
- **path**: Find files matching a pattern (default)
- **affected**: Find all files affected if a specific file changes
- **critical**: Find the most important files (most depended-on)
- **orphans**: Find isolated files with no connections

Choose the most appropriate mode based on the user's question and execute the search.

Present results in Japanese with clear formatting:
- ファイルパスと依存関係の数
- 検索にマッチした理由
- 推奨アクション（影響分析の場合）
