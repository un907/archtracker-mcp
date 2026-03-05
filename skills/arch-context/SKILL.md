---
name: arch-context
description: Load the current architecture context into the session. Use at the start of a new session or when you need to understand the project structure. Prevents hallucination of old file paths.
allowed-tools:
  - mcp__archtracker__get_current_context
---

## Load Architecture Context

Retrieve and display the current project architecture context.

1. Call `get_current_context` to get valid file paths and architecture summary
2. Internalize the returned structure so you reference only existing files
3. Display a brief summary to the user

Present results in Japanese:
- 現在の有効なファイルパス一覧
- アーキテクチャの概要サマリー
- 前回のスナップショットからの経過時間（あれば）

**重要**: このコンテキストを元に、以降のセッションでは存在しないファイルパスを参照しないこと。
