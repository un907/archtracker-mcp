# ArchTracker MCP — アーキテクチャ構成図

## システム全体像

```
┌─────────────────────────────────────────────────────────────────┐
│                        ユーザー環境                              │
│                                                                 │
│  ┌──────────────┐    ┌──────────────────────────────────────┐   │
│  │  Claude Code  │◄──►│        ArchTracker MCP Server        │   │
│  │  (AI Agent)   │    │         (stdio transport)            │   │
│  └──────┬───────┘    └──────────────┬───────────────────────┘   │
│         │                           │                           │
│         │ /arch-check               │ Tools:                    │
│         │ /arch-snapshot            │  ├─ generate_map          │
│         │ /arch-context             │  ├─ save_architecture_    │
│         │                           │  │  snapshot              │
│  ┌──────▼───────┐                   │  ├─ check_architecture_  │
│  │    Skills     │                   │  │  diff                  │
│  │  (SKILL.md)   │                   │  └─ get_current_context  │
│  └──────────────┘                   │                           │
│                              ┌──────▼───────┐                   │
│                              │   Analyzer    │                   │
│                              │ (dep-cruiser) │                   │
│                              └──────┬───────┘                   │
│                                     │                           │
│                              ┌──────▼───────┐                   │
│                              │   Storage     │                   │
│                              │ (.archtracker)│                   │
│                              └──────────────┘                   │
│                                                                 │
│  ┌──────────────┐                                               │
│  │  CLI          │──── archtracker init / check                  │
│  │  (commander)  │     (CI / pre-commit / 手動)                  │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

## レイヤー構成

```
┌─────────────────────────────────────────────────┐
│              Interface Layer                     │
│  ┌───────────┐  ┌───────────┐  ┌─────────────┐ │
│  │ MCP Server│  │    CLI    │  │   Skills    │ │
│  │ (stdio)   │  │(commander)│  │ (SKILL.md)  │ │
│  └─────┬─────┘  └─────┬─────┘  └──────┬──────┘ │
├────────┼──────────────┼────────────────┼────────┤
│        └──────────┬───┘                │        │
│              Core Layer                │        │
│  ┌────────────────▼────────────────┐   │        │
│  │         Analyzer                 │   │        │
│  │  ┌──────────────────────────┐   │   │        │
│  │  │   dependency-cruiser     │   │   │        │
│  │  │   (AST 解析)             │   │   │        │
│  │  └──────────────────────────┘   │   │        │
│  │  ┌──────────────────────────┐   │   │        │
│  │  │   Graph Builder          │   │   │        │
│  │  │   (DependencyGraph 構築) │   │   │        │
│  │  └──────────────────────────┘   │   │        │
│  └─────────────────────────────────┘   │        │
│                                        │        │
│  ┌─────────────────────────────────┐   │        │
│  │         Storage                  │   │        │
│  │  ┌──────────────────────────┐   │   │        │
│  │  │   Snapshot Manager       │   │   │        │
│  │  │   (.archtracker/*.json)  │   │   │        │
│  │  └──────────────────────────┘   │   │        │
│  │  ┌──────────────────────────┐   │   │        │
│  │  │   Diff Engine            │   │   │        │
│  │  │   (変更検出 + 影響分析)  │   │   │        │
│  │  └──────────────────────────┘   │   │        │
│  └─────────────────────────────────┘   │        │
├────────────────────────────────────────┼────────┤
│              Data Layer                │        │
│  ┌─────────────────────────────────┐   │        │
│  │  Types / Schema                  │   │        │
│  │  version: "1.0"                  │   │        │
│  │  ArchSnapshot, DependencyGraph,  │   │        │
│  │  ArchDiff, ArchContext           │   │        │
│  └─────────────────────────────────┘   │        │
└────────────────────────────────────────┴────────┘
```

## データフロー

```
[対象プロジェクト]
       │
       │ ファイル群 (*.ts, *.js, *.tsx, *.jsx)
       ▼
┌──────────────┐
│  Analyzer    │  dependency-cruiser で AST 解析
│  (Phase 2)   │  → DependencyGraph 型に変換
└──────┬───────┘
       │ DependencyGraph (JSON)
       ▼
┌──────────────┐     ┌─────────────────────┐
│   Storage    │◄───►│ .archtracker/       │
│  (Phase 3)   │     │   snapshot.json     │
└──────┬───────┘     └─────────────────────┘
       │ ArchDiff
       ▼
┌──────────────┐
│ MCP / CLI    │  影響レポートを AI / ユーザーに返却
│ (Phase 4-5)  │
└──────────────┘
```

## ファイル構成

```
archtracker-mcp/
├── src/
│   ├── types/
│   │   └── schema.ts          ← 全型定義（バージョン付き）
│   ├── analyzer/
│   │   ├── index.ts           ← エクスポート
│   │   └── analyze.ts         ← dependency-cruiser 統合
│   ├── storage/
│   │   ├── index.ts           ← エクスポート
│   │   ├── snapshot.ts        ← 読み書き
│   │   └── diff.ts            ← 差分計算
│   ├── mcp/
│   │   └── index.ts           ← MCP サーバー (4ツール)
│   ├── cli/
│   │   └── index.ts           ← CLI エントリポイント
│   └── index.ts               ← パブリック API
├── skills/
│   ├── arch-check/SKILL.md    ← /arch-check
│   ├── arch-snapshot/SKILL.md ← /arch-snapshot
│   └── arch-context/SKILL.md  ← /arch-context
├── docs/
│   ├── PLAN.md                ← 実装計画書
│   ├── TASKS.md               ← タスク管理表
│   ├── ARCHITECTURE.md        ← 本ドキュメント
│   └── DEPENDENCY-MAP.md      ← 依存関係マップ
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```
