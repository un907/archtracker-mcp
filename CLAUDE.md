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
├── mcp/index.ts              # MCP server (6 tools: generate_map, analyze_existing_architecture, save_architecture_snapshot, check_architecture_diff, get_current_context, search_architecture)
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
│   ├── server.ts             # node:http サーバー (startViewer → 単一HTML応答、Express不使用)
│   ├── template.ts           # buildGraphPage() — オーケストレータ + i18n + settings + graph view JS (~1020行)
│   ├── styles.ts             # buildStyles() — CSS (~157行)
│   ├── viewer-html.ts        # buildViewerHtml() — HTML body構造 (~165行)
│   ├── js-hierarchy.ts       # buildHierarchyJs() — 階層図ビュー JS (~325行)
│   └── js-diff.ts            # buildDiffJs() — 差分ビュー JS (~188行)
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
- 5ファイル構成: `template.ts` (オーケストレータ+graph JS), `styles.ts` (CSS), `viewer-html.ts` (HTML), `js-hierarchy.ts` (階層図), `js-diff.ts` (差分ビュー)
- 各ファイルは文字列を返す関数をエクスポート → `buildGraphPage()` が連結して単一 HTML を生成 (SPA)
- D3.js は CDN から読み込み
- `server.ts`: `node:http` で `/` に HTML を返すだけ (Express 不使用、依存ゼロ)
- フレームワーク不使用: vanilla JS + d3.js force simulation
- 状態管理: module-level 変数 + 関数ポインタパターン (`applyLayerFilter`, `hierRelayout`, `hierSyncFromTab`)
- `template.ts` 内の JS は template literal 内の文字列。TypeScript の型チェックは効かない

### template.ts 内部構造

**データ注入** — `buildGraphPage()` が以下をクライアント JS にインライン埋め込み:
```
const DATA = ${JSON.stringify(graphData)};   // nodes, links, dirs, circularFiles
const LAYERS = ${layersData};                // LayerMetadata[] or null
const CROSS_EDGES = ${crossEdgesData};       // CrossLayerConnection[] or null
const DIFF = ${diffData};                    // ArchDiff or null (js-diff.ts内)
```

**3つのビュー** (ファイル分割):
1. **Graph View** (template.ts): d3 force simulation, convex hull レイヤーグループ, レイヤータブ
2. **Hierarchy View** (js-hierarchy.ts): 深度ベース DAG レイアウト, `buildHierarchy()` で遅延構築
3. **Diff View** (js-diff.ts): 独立 simulation, レイヤーブロッキング, diff-aware ハイライト

**レイヤーフィルタモデル** (include-filter):
- `activeLayers: Set<string>` — 空 = 全表示 (フィルタなし), 非空 = 選択されたレイヤーのみ表示
- `activeLayerFilter` は DEPRECATED (後方互換で残存、常に null)
- レイヤータブはマルチセレクトトグル。Shift+クリックでソロモード
- "All" タブは `activeLayers.clear()` でリセット

**関数ポインタパターン** (ビュー間同期):
- `applyLayerFilter` — graph view のノード/リンク表示切替 + physics 更新 + hull 更新
- `hierRelayout` / `hierSyncFromTab` — hierarchy view をクロージャ外から呼ぶためのポインタ (buildHierarchy() 内で代入)
- グラフのタブクリック → `applyLayerFilter()` + `hierSyncFromTab()` + `hierRelayout()` で両ビュー同期

**Physics パラメータ**:
- `gravityStrength` (Gravity slider) — `forceManyBody().strength(-gravityStrength)`
- `layerGravity` (Layer Cohesion slider) — `forceX/Y().strength(layerGravity/100)` でレイヤー中心への引力
- `getLayerCenters()` — activeLayers に応じて動的に中心座標を計算 (全表示=フル円, 複数選択=コンパクト円, 単体=原点)
- `clusterForce()` — カスタム d3 force: ノードをレイヤー重心に引っ張る (表面張力)

**設定永続化**: `saveSettings()` → localStorage, `loadSettings()` → 起動時に2フェーズ復元 (グラフ構築前 + 後)

### マルチレイヤー設計
- `.archtracker/layers.json` に定義 → `loadLayerConfig()` で読み込み
- `--target` 未指定 + layers.json 存在 → 自動的にマルチレイヤー解析
- 各レイヤーを独立に `analyzeProject()` → `mergeLayerGraphs()` で統合
- 統合グラフのパスはレイヤー名プレフィックス付き: `Backend/worker.py`
- クロスレイヤー接続: 手動定義 (layers.json) + 自動検出 (共有ファイル名)
- Snapshot schema v1.1: `multiLayer` optional フィールド追加 (v1.0 と後方互換)

### layers.json スキーマ (重要 — 間違えると検出不能)
- 配置場所: `<projectRoot>/.archtracker/layers.json` (トップレベルではない!)
- 必須フィールド: `version: "1.0"` (文字列), `layers[]`
- レイヤー必須: `name`, `targetDir` (NOT `path`), `language` (LanguageId)
- レイヤー任意: `color`, `description`
- `connections[]` は任意: `fromLayer`, `fromFile`, `toLayer`, `toFile`, `type`, `label`
- スキーマ定義: `src/types/layers.ts` の `LayerConfigSchema` (Zod)

### 解析エンジン
- 全13言語が `RegexEngine` を使用 (外部依存なし)
- `LanguageConfig` で言語ごとの import パターン、resolver、コメントスタイルを定義
- `extractImports` カスタムフックで複雑な構文に対応 (Rust grouped use, C# class references)
- コメント除去 → import 抽出 → パス解決 → エッジ生成 のパイプライン

### `--root` vs `--target` (重要: マルチレイヤーで最も踏む地雷)
- `--target <dir>`: 解析対象ディレクトリ (デフォルト `src`)。**明示指定するとマルチレイヤー自動検出がスキップされる**
- `--root <dir>`: プロジェクトルート (`.archtracker/` の場所)。デフォルト `.`
- マルチレイヤーを使うには: `--root /path/to/project` を指定し、`--target` は指定しない
- CLI判定 (`resolveGraph`): `process.argv` に `-t` or `--target` があるか → あれば単一ディレクトリ
- MCP判定 (`resolveGraphForMcp`): `targetDir === "src"` (デフォルト値) か → デフォルトなら layers.json を探す
- よくある間違い: `archtracker serve --target /tmp/project` → マルチレイヤー無視。正しくは `--root /tmp/project`

### npm パッケージ構成
- `package.json` の `"files": ["dist", "skills"]` — dist/ と skills/ のみ publish
- ソースコード (src/) は npm パッケージに含まれない
- `dist/` 内は tsup がバンドル済み。node_modules の依存は外部化 (実行時に必要)

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
# 大規模7レイヤーフィクスチャ (74ファイル, レイヤー/hull/cross-layer全機能テスト可能)
node dist/bin.js serve --port 3456 --root src/analyzer/__fixtures__/large-project

# 単一ディレクトリ (レイヤーなし)
node dist/bin.js serve --target src --port 3456

# ⚠️ --target を明示指定するとマルチレイヤー検出がスキップされる!
# マルチレイヤーテストは必ず --root のみで起動すること
```

ブラウザで http://localhost:3456 を開いて目視確認。
`template.ts` 変更後は `npm run build` → サーバー再起動が必要。

### テストフィクスチャ一覧
- `__fixtures__/large-project/` — 7レイヤー・74ファイル、layers.json + cross-layer connections。全Web Viewer機能の目視テスト用
- `__fixtures__/multi-layer-project/` — 2レイヤー (Frontend/Backend)、自動テスト用
- `__fixtures__/sample-project/` — 単一ディレクトリ5ファイル、基本テスト用
- その他: 各言語ごとのフィクスチャ (cpp, python, rust, go, java, etc.)

## MCP Tool の使い分け

| Tool | 用途 | 返却形式 |
|------|------|---------|
| `generate_map` | プログラム的にグラフ構造を取得 | raw JSON |
| `analyze_existing_architecture` | 人間向けレポート | Markdown テキスト |
| `save_architecture_snapshot` | ベースライン保存 | 確認メッセージ |
| `check_architecture_diff` | スナップショット差分 | 差分レポート |
| `get_current_context` | AIセッション初期化 | パス一覧 + サマリー |
| `search_architecture` | 検索 (4モード: path/affected/critical/orphans) | 検索結果 |

`generate_map` と `analyze_existing_architecture` の混同に注意。前者は JSON、後者は人間向け。

## Gotchas

- Web viewer の JS は template literal 内の文字列 (template.ts, js-hierarchy.ts, js-diff.ts)。TypeScript の型チェックは効かない。ブラウザコンソールで確認
- `const` 宣言の Temporal Dead Zone (TDZ) に注意: template.ts 内の変数宣言順序が初期化順序と一致する必要がある。特に `activeLayers` は `nodeColor()` より前に宣言必須 (v0.5.0で踏んだバグ)
- `resolveGraph()` は `src/analyzer/resolve.ts` に統一済み。CLI は `!isTargetExplicit()` で `useMultiLayer` を決定、MCP は `targetDir === "src"` で決定
- Snapshot schema version: v1.0 と v1.1 の両方を Zod union で受け入れ。新規保存は常に v1.1
- Web viewer の force simulation: `DATA.links` 内のオブジェクトは d3 により source/target が node reference に変更される (破壊的)。Diff view は独立した `simLinks` / `simNodes` を使う必要がある
- Diff view の `updateDiffHulls()` は tick ごとに呼ぶとフリーズする。5 tick に1回にスロットル (v0.6.0で改善)
- Web viewer のデバッグ: `npm run build` → サーバー再起動 → ブラウザリロード。ホットリロードなし
- layers.json のフィールド名は `targetDir` であり `path` ではない。`version: "1.0"` も必須。間違えると silent fail で LAYERS=null になる
- `--target` を明示指定した時点で `useMultiLayer=false`。`--root` だけ指定して `--target` は省略するのが正しいパターン。これは設計上の制約であり **バグではないが地雷** — 将来的に `--root` 指定時は `--target` 明示でも layers.json を探すべきかもしれない (v0.7.0検討)
