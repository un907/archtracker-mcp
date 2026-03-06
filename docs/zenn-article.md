---
title: "AIエージェントは依存関係を壊す——MCPサーバーで「影響範囲」を理解させる仕組みを作った"
emoji: "🏗️"
type: "tech"
topics: ["mcp", "claudecode", "typescript", "architecture", "oss"]
published: true
---

## AIエージェントにコードを任せて、壊れたことありませんか？

Claude Code や Cursor で「`auth.ts` をリファクタして」と頼む。AIは見事にリファクタする。でもそのファイルに依存する **12個のファイル** が壊れていることに、AIは気づかない。

これは「AIが無能」なのではなく、**AIにプロジェクト全体の依存関係が見えていない**のが原因です。

| よくある事故 | 原因 |
|-------------|------|
| リファクタ後に別ファイルで型エラー大量発生 | 被依存ファイルを把握していない |
| 前のセッションで変更されたファイルパスを参照 | 古いコンテキストが残っている |
| 「影響範囲小さいです」と言いながら実は大破壊 | 推移的な依存関係を追えていない |
| PRレビューで「これ他に影響ない？」と聞かれて沈黙 | 手動で依存追跡するのは無理 |

この問題を **MCP（Model Context Protocol）** で根本解決するツールを作りました。

## archtracker-mcp — アーキテクチャを「理解する」MCPサーバー

https://github.com/un907/archtracker-mcp

**archtracker-mcp** は、プロジェクトの依存関係を解析し、AIエージェントに「影響範囲」を教えるMCPサーバーです。

MCPサーバーだけでなく、**CLI** / **インタラクティブWebビューア** / **Claude Code Skills** としても使えます。

```bash
npm install -g archtracker-mcp
```

### できること

- **依存関係グラフ解析** — AST静的解析（dependency-cruiser ベース）
- **影響シミュレーション** — ファイルをクリック → 推移的に影響を受ける全ファイルをBFS探索
- **スナップショット差分** — アーキテクチャの変化を自動検出
- **インタラクティブ可視化** — D3.js による力学モデルグラフ + 階層図 + 差分ビュー
- **CI統合** — PRでアーキテクチャドリフトを自動チェック
- **多言語対応** — 日本語 / 英語（`LANG` 環境変数から自動検出）

## MCPサーバーとして使う

Claude Code の設定ファイルに追加するだけ：

```json
{
  "mcpServers": {
    "archtracker": {
      "command": "npx",
      "args": ["-y", "archtracker-mcp"]
    }
  }
}
```

これで Claude Code に **5つのツール** が追加されます：

| ツール | 何ができるか |
|--------|-------------|
| `generate_map` | 依存関係グラフを解析し構造化JSONで返す |
| `save_architecture_snapshot` | 現在のアーキテクチャをスナップショットとして保存 |
| `check_architecture_diff` | 前回のスナップショットと比較し、変更と影響を表示 |
| `get_current_context` | 有効なファイルパスとアーキテクチャサマリーを返す |
| `search_architecture` | パス・影響範囲・重要度・孤立ファイルで検索 |

### 実際の使い方

AIに「`auth.ts` をリファクタして」と依頼する **前に**：

```
あなた: auth.ts を変更したいんだけど、影響範囲を教えて

Claude Code: (generate_map ツールを使用)
auth.ts を変更すると、以下の12ファイルに影響があります：
- src/middleware/session.ts (直接依存)
- src/routes/login.ts (直接依存)
- src/routes/register.ts (直接依存)
- src/routes/api/*.ts (推移的依存 x 9)

影響度の高い変更です。段階的なリファクタを推奨します。
```

AIが影響範囲を **理解した上で** リファクタを行うので、破壊的変更が大幅に減ります。

## Webビューアで「見る」

```bash
archtracker serve --target src --watch
# => http://localhost:3000
```

### グラフビュー（力学モデル）

依存関係を力学モデルで可視化。ノードをドラッグ・ズームして探索できます。

- **クリックでピン固定** — ハイライトをロックして、他のノードをホバーで比較
- **影響モード** — ファイルをクリックすると推移的な被依存ファイルが赤くハイライト
- **ディレクトリフィルタ** — 下部のピルで特定ディレクトリだけ表示
- **カスタマイズ** — 重力、ノードサイズ、フォントサイズ、リンク透明度を調整

### 階層ビュー（DAGレイアウト）

依存の深さに基づくレイヤー型レイアウト。プロジェクトの全体構造を俯瞰するのに最適です。

### 差分ビュー

スナップショットとの差分を色分けで表示：
- 🟢 追加 / 🔴 削除 / 🟡 変更 / 🔵 影響を受けたファイル

## CLIで日常的に使う

```bash
# プロジェクトの依存関係を分析
archtracker analyze --target src

# ベースラインスナップショットを保存
archtracker init --target src

# アーキテクチャドリフトをチェック（CIモード）
archtracker check --target src --ci

# AIセッション用のコンテキストを取得
archtracker context --target src --json
```

`archtracker check --ci` は変更があった場合に **exit code 1** を返すので、CIに組み込めます：

```yaml
# .github/workflows/arch-check.yml
name: Architecture Check
on:
  pull_request:
    branches: [main]
jobs:
  arch-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npx archtracker check --target src --ci
```

これも一発で生成できます：

```bash
archtracker ci-setup --target src
```

## Claude Code Skills でさらに便利に

`skills/` ディレクトリをプロジェクトにコピーすると、Claude Code のスラッシュコマンドとして使えます：

```bash
cp -r node_modules/archtracker-mcp/skills/ .claude/skills/
```

| スキル | 説明 |
|--------|------|
| `/arch-analyze` | 包括的なアーキテクチャ分析 |
| `/arch-check` | スナップショットと現在のコードを比較 |
| `/arch-snapshot` | アーキテクチャスナップショットを保存 |
| `/arch-context` | AIセッションを有効なパスで初期化 |
| `/arch-search` | アーキテクチャ検索 |

## プログラマティックAPIとしても使える

```typescript
import {
  analyzeProject,
  saveSnapshot,
  loadSnapshot,
  computeDiff,
  formatDiffReport,
} from "archtracker-mcp";

// 依存関係を解析
const graph = await analyzeProject("src", { exclude: ["__tests__"] });

// スナップショットを保存
await saveSnapshot(".", graph);

// 差分を比較
const prev = await loadSnapshot(".");
if (prev) {
  const diff = computeDiff(prev.graph, graph);
  console.log(formatDiffReport(diff));
}
```

独自のCI/CDパイプラインやカスタムツールに組み込むことができます。

## なぜ「ブルーオーシャン」なのか

依存関係の可視化ツールは既にあります（dependency-cruiser、Madge、dpdm など）。しかし：

| 既存ツール | archtracker-mcp |
|-----------|-----------------|
| 人間が手動で実行 | **AIエージェントがMCP経由で自動実行** |
| 静的な画像出力 | **インタラクティブなWebビューア** |
| 現在の状態だけ表示 | **スナップショット差分で変化を検出** |
| 依存関係の一覧 | **影響シミュレーションで推移的影響を可視化** |
| CLIのみ | **MCP + CLI + Web + Skills の4つのインターフェース** |

「依存関係分析 × AIエージェント × MCP」の組み合わせは、まだほとんど誰もやっていません。

## 技術スタック

| 技術 | 用途 |
|------|------|
| TypeScript | 全コード |
| `@modelcontextprotocol/sdk` | MCPサーバー実装 |
| `dependency-cruiser` | AST静的解析エンジン |
| `D3.js v7` | インタラクティブ可視化（インライン埋め込み） |
| `commander` | CLI |
| `zod` | スキーマバリデーション |
| `tsup` | ビルド（3エントリーポイント: mcp / cli / index） |
| `vitest` | テスト（54テスト: unit + E2E） |

## まとめ

AIエージェント時代の開発では、**AIにプロジェクトのアーキテクチャを理解させる** ことが重要になります。

archtracker-mcp は：

1. **MCP経由で** AIエージェントに影響範囲を伝える
2. **スナップショットで** アーキテクチャの変化を追跡する
3. **Webビューアで** 人間にも直感的に依存関係を見せる
4. **CIで** PRごとにアーキテクチャドリフトを自動チェックする

**AIに壊させる前に、AIに理解させる。** それが archtracker-mcp のコンセプトです。

---

GitHub: https://github.com/un907/archtracker-mcp
npm: https://www.npmjs.com/package/archtracker-mcp

スターいただけると励みになります！Issue / PR も歓迎です。
