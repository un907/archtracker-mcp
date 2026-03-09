# CLAUDE.md — archtracker-mcp

## Project Overview

**archtracker-mcp** — AI駆動開発向けアーキテクチャ & 依存関係トラッカー。
MCP Server + CLI + Web Viewer + Claude Code Skills の4つのインターフェースを持つ。
npm パッケージ名: `archtracker-mcp` / GitHub: `un907/archtracker-mcp` / 現在 v0.5.0。

## Tech Stack

- **Language**: TypeScript (ESM, `"type": "module"`)
- **Runtime**: Node.js >= 18
- **Build**: tsup (4エントリポイント → `dist/`)
- **Test**: Vitest (403 tests, ~1s)
- **Type Check**: `tsc --noEmit`
- **Production Dependencies**: `@modelcontextprotocol/sdk`, `commander`, `zod` のみ
- **Dev Dependencies**: `@types/node`, `playwright`, `tsup`, `typescript`, `vitest`
- **Web Viewer**: D3.js v7 (CDN), vanilla JS (template literal 埋め込み、フレームワークなし)

## Commands

```bash
npm run build       # tsup ビルド → dist/
npm test            # vitest run (403 tests)
npm run typecheck   # tsc --noEmit
npm run dev         # tsup --watch
```

## Directory Structure

```
src/
├── index.ts                  # Public API re-exports (ライブラリ用)
├── bin.ts                    # Smart entry: CLI subcommand あり→CLI, なし→MCP server
├── cli/index.ts              # commander ベースの CLI (init, analyze, check, context, serve, ci-setup, layers)
├── mcp/index.ts              # MCP server (5 tools: generate_map, analyze_existing_architecture, save_architecture_snapshot, check_architecture_diff, get_current_context, search_architecture)
├── analyzer/
│   ├── analyze.ts            # analyzeProject() — 単一ディレクトリ解析のメイン
│   ├── multi-layer.ts        # analyzeMultiLayer(), detectCrossLayerConnections() — マルチレイヤー解析
│   ├── search.ts             # searchByPath, findAffectedFiles, findCriticalFiles, findOrphanFiles
│   ├── report.ts             # formatAnalysisReport() — 人間向けレポート生成
│   ├── index.ts              # barrel export
│   ├── engines/
│   │   ├── types.ts          # LANGUAGE_IDS (Single Source of Truth), LanguageId, LanguageConfig, AnalyzerEngine
│   │   ├── languages.ts      # 13言語の LanguageConfig 定義 (importPatterns, resolveImport, commentStyle)
│   │   ├── regex-engine.ts   # RegexEngine — 全13言語共通の正規表現ベース解析エンジン
│   │   ├── detect.ts         # detectLanguage() — マーカーファイル検出 + 拡張子フォールバック
│   │   ├── cycle.ts          # DFS 循環依存検出
│   │   └── strip-comments.ts # 言語別コメント除去
│   ├── __fixtures__/         # テスト用フィクスチャ (sample-project, multi-layer-project)
│   ├── *.test.ts             # analyze, engines, multi-layer, search, crosslayer, orphan テスト
├── storage/
│   ├── snapshot.ts           # saveSnapshot, loadSnapshot (Zod validation, schema v1.0/1.1)
│   ├── diff.ts               # computeDiff, formatDiffReport
│   ├── layers.ts             # loadLayerConfig, saveLayerConfig (.archtracker/layers.json)
│   ├── index.ts              # barrel export
│   └── *.test.ts
├── web/
│   ├── server.ts             # Express サーバー (startViewer → 単一HTML応答)
│   └── template.ts           # buildGraphPage() — 全 HTML/CSS/JS を template literal で生成 (~1700行)
├── types/
│   ├── schema.ts             # DependencyGraph, ArchSnapshot, ArchDiff, MultiLayerGraph, LayerMetadata
│   └── layers.ts             # LayerDefinition, LayerConfig, CrossLayerConnection
├── i18n/index.ts             # t(), setLocale() — EN/JA 2言語 (90+ keys)
├── utils/
│   ├── version.ts            # VERSION — package.json から読み込み (Single Source of Truth)
│   └── path-guard.ts         # validatePath() — パストラバーサル防止
└── e2e/
    ├── e2e.test.ts           # E2E テスト (CLI, snapshot, diff)
    └── robustness.test.ts    # 堅牢性テスト (不正入力, エッジケース)

skills/                       # Claude Code Skills (6個)
├── arch-analyze/SKILL.md
├── arch-check/SKILL.md
├── arch-context/SKILL.md
├── arch-search/SKILL.md
├── arch-serve/SKILL.md
└── arch-snapshot/SKILL.md
```

## Architecture Principles

### Single Source of Truth
- **バージョン**: `package.json` → `src/utils/version.ts` → CLI/MCP 両方が参照
- **言語リスト**: `LANGUAGE_IDS` (`src/analyzer/engines/types.ts`) → MCP tool description, CLI --language, テスト全てがここを参照
- 新言語追加時は `types.ts` の `LANGUAGE_IDS` と `languages.ts` の `LANGUAGE_CONFIGS` に追加するだけ

### 4つのエントリポイント (tsup.config.ts)
1. **`dist/bin.js`** — `archtracker-mcp` bin。引数でCLI/MCPを自動振り分け
2. **`dist/cli/index.js`** — `archtracker` bin。commander ベースCLI
3. **`dist/mcp/index.js`** — MCP server (stdio transport)
4. **`dist/index.js`** — ライブラリ API (programmatic usage)

### Web Viewer の設計
- `template.ts` が全 HTML/CSS/JS を1つの文字列として生成 (SPA、外部ファイルなし)
- D3.js は CDN から読み込み
- `buildGraphPage(graph, options)` → HTML string → Express が `/` で返す
- フレームワーク不使用: vanilla JS + d3.js force simulation
- 状態管理: module-level 変数 + 関数ポインタパターン (`applyLayerFilter`, `hierRelayout`, `hierSyncFromTab`)
- `template.ts` は巨大 (~1700行) だが意図的に単一ファイル。分割すると HTML/CSS/JS の連携が複雑化する

### マルチレイヤー設計
- `.archtracker/layers.json` に定義 → `loadLayerConfig()` で読み込み
- `--target` 未指定 + layers.json 存在 → 自動的にマルチレイヤー解析
- 各レイヤーを独立に `analyzeProject()` → `mergeLayerGraphs()` で統合
- 統合グラフのパスはレイヤー名プレフィックス付き: `Backend/worker.py`
- クロスレイヤー接続: 手動定義 (layers.json) + 自動検出 (共有ファイル名)
- Snapshot schema v1.1: `multiLayer` optional フィールド追加 (v1.0 と後方互換)

### 解析エンジン
- 全13言語が `RegexEngine` を使用 (外部依存なし)
- `LanguageConfig` で言語ごとの import パターン、resolver、コメントスタイルを定義
- `extractImports` カスタムフックで複雑な構文に対応 (Rust grouped use, C# class references)
- コメント除去 → import 抽出 → パス解決 → エッジ生成 のパイプライン

## Key Design Decisions

- **dependency-cruiser 除去 (v0.4.0)**: JS/TS も RegexEngine に統一。パッケージサイズ 80MB → 25MB
- **Zod バリデーション**: snapshot.json, layers.json の読み込みに Zod スキーマを使用
- **パストラバーサル防止**: 全ファイル操作で `validatePath()` を通す
- **i18n**: ランタイムで `LANG` 環境変数から自動検出。Web viewer は localStorage で永続化
- **Smart bin entry (v0.4.2)**: `archtracker-mcp` コマンドが引数の有無で CLI/MCP を自動判別

## Release Process

リリース前に必ず実インストールテストを実行する:

1. `npm run build` + `npm test` — 全パス
2. `npm pack` → 別ディレクトリに `npm install <tarball>` — クリーンインストール
3. 実ユーザーフロー検証:
   - `npx archtracker-mcp` (引数なし) → MCP サーバー起動
   - `npx archtracker serve --target <dir>` → Web ビューア + HTTP 200
   - `npx archtracker analyze --target <dir>` → 分析レポート
   - `npx archtracker --help` → ヘルプ表示
   - `archtracker analyze --language <lang> --target <dir>` → 言語指定
4. bin エントリ + shebang 検証
5. TypeScript なしで動作確認

npm publish には OTP (リカバリーコード) が必要: `npm publish --otp=<code>`

## Testing

```bash
npm test                      # 全403テスト実行
npm run test:watch            # ウォッチモード
```

テストファイル配置: 対象ファイルと同階層に `*.test.ts`。
フィクスチャ: `src/analyzer/__fixtures__/` 配下。

## Web Viewer 開発時の確認方法

```bash
# 13レイヤーテスト用フィクスチャ (要事前セットアップ)
node dist/bin.js serve --port 3456 --root /tmp/multi-layer-visual-test

# 単一ディレクトリ
node dist/bin.js serve --target src --port 3456
```

ブラウザで http://localhost:3456 を開いて目視確認。
`template.ts` 変更後は `npm run build` → サーバー再起動が必要。

## Gotchas

- `template.ts` 内の JS は template literal 内の文字列。TypeScript の型チェックは効かない。ブラウザコンソールで確認
- `const` 宣言の Temporal Dead Zone (TDZ) に注意: `template.ts` 内の変数宣言順序が初期化順序と一致する必要がある
- `resolveGraph()` (CLI) と `resolveGraphForMcp()` (MCP) は別実装。CLI は `process.argv` で `--target` 明示判定、MCP は `targetDir === "src"` で判定
- Snapshot schema version: v1.0 と v1.1 の両方を Zod union で受け入れ。新規保存は常に v1.1
- Web viewer の force simulation: `DATA.links` 内のオブジェクトは d3 により source/target が node reference に変更される (破壊的)
