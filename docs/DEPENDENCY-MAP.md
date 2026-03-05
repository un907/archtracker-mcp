# ArchTracker MCP — 内部依存関係マップ

> 最終更新: 2026-03-05 (Phase 1 完了時点)
> ArchTracker 自身の内部依存関係を記録する（自己参照的ドッグフーディング）

## モジュール間依存関係

```
src/index.ts
  ├──► src/types/schema.ts        (型の再エクスポート)
  ├──► src/analyzer/index.ts      (analyzeProject)
  └──► src/storage/index.ts       (saveSnapshot, loadSnapshot, computeDiff)

src/analyzer/index.ts
  └──► src/analyzer/analyze.ts    (analyzeProject)

src/analyzer/analyze.ts
  └──► src/types/schema.ts        (DependencyGraph 型)

src/storage/index.ts
  ├──► src/storage/snapshot.ts    (saveSnapshot, loadSnapshot)
  └──► src/storage/diff.ts        (computeDiff)

src/storage/snapshot.ts
  └──► src/types/schema.ts        (ArchSnapshot 型)

src/storage/diff.ts
  └──► src/types/schema.ts        (ArchDiff, DependencyGraph 型)

src/mcp/index.ts                  [Phase 4 で実装]
  ├──► src/analyzer/index.ts
  ├──► src/storage/index.ts
  └──► src/types/schema.ts

src/cli/index.ts                  [Phase 5 で実装]
  ├──► src/analyzer/index.ts
  ├──► src/storage/index.ts
  └──► src/types/schema.ts
```

## 依存方向ルール

```
Interface (mcp, cli, skills)
         │
         ▼  依存は常に上から下へ
     Core (analyzer, storage)
         │
         ▼
     Data (types/schema)
```

**禁止**: 下位レイヤーが上位レイヤーに依存すること
- ✅ mcp → analyzer → types
- ✅ cli → storage → types
- ❌ types → analyzer (禁止)
- ❌ analyzer → mcp (禁止)

## 外部依存パッケージ

| パッケージ | 使用箇所 | 用途 |
|-----------|----------|------|
| `@modelcontextprotocol/sdk` | src/mcp/ | MCP サーバー構築 |
| `dependency-cruiser` | src/analyzer/ | AST 解析・依存関係抽出 |
| `zod` | src/mcp/ | ツール引数バリデーション |
| `commander` | src/cli/ | CLI コマンド定義 |

## Skills → MCP ツール マッピング

| Skill | 使用する MCP ツール |
|-------|---------------------|
| `/arch-check` | `generate_map`, `check_architecture_diff` |
| `/arch-snapshot` | `generate_map`, `save_architecture_snapshot` |
| `/arch-context` | `get_current_context` |
