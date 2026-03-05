# ArchTracker MCP — タスク管理表

> 最終更新: 2026-03-05

## Phase 2: Analyzer 実装

| # | タスク | 状態 | 担当 | 備考 |
|---|--------|------|------|------|
| 2.1 | dependency-cruiser API 調査・統合 | ⬚ | Claude | cruise() 関数の直接呼び出し |
| 2.2 | 解析結果を DependencyGraph 型に変換 | ⬚ | Claude | 軽量フォーマットに整形 |
| 2.3 | 除外パターン (node_modules, dist 等) | ⬚ | Claude | オプションで設定可能に |
| 2.4 | maxDepth オプション実装 | ⬚ | Claude | クソデカ Repo 対策 |
| 2.5 | 循環参照の検出と警告 | ⬚ | Claude | クラッシュさせずレポート |
| 2.6 | ユニットテスト (Vitest) | ⬚ | Claude | テストフィクスチャ作成 |

## Phase 3: Storage 実装

| # | タスク | 状態 | 担当 | 備考 |
|---|--------|------|------|------|
| 3.1 | .archtracker/ ディレクトリ管理 | ⬚ | Claude | init 時に作成 |
| 3.2 | snapshot.json 読み書き | ⬚ | Claude | バージョン付き |
| 3.3 | diff 計算ロジック | ⬚ | Claude | 追加/削除/変更 + 影響範囲 |
| 3.4 | 影響レポート生成（日本語） | ⬚ | Claude | AI が読みやすい形式 |
| 3.5 | ユニットテスト (Vitest) | ⬚ | Claude | |

## Phase 4: MCP サーバー実装

| # | タスク | 状態 | 担当 | 備考 |
|---|--------|------|------|------|
| 4.1 | McpServer セットアップ | ⬚ | Claude | stdio トランスポート |
| 4.2 | generate_map ツール | ⬚ | Claude | |
| 4.3 | save_architecture_snapshot ツール | ⬚ | Claude | |
| 4.4 | check_architecture_diff ツール | ⬚ | Claude | |
| 4.5 | get_current_context ツール | ⬚ | Claude | snapshot 不在時は自動生成 |
| 4.6 | エラーハンドリング統合 | ⬚ | Claude | |

## Phase 5: CLI + Skills 統合

| # | タスク | 状態 | 担当 | 備考 |
|---|--------|------|------|------|
| 5.1 | archtracker init コマンド | ⬚ | Claude | |
| 5.2 | archtracker check コマンド | ⬚ | Claude | CI/pre-commit 対応 |
| 5.3 | Skills 最終調整 | ⬚ | Claude | MCP ツール名バインド |
| 5.4 | E2E テスト | ⬚ | Claude | |

## 完了済み

| # | タスク | 完了日 |
|---|--------|--------|
| 1.1 | npm init + TypeScript 設定 | 2026-03-05 |
| 1.2 | tsup ビルドパイプライン | 2026-03-05 |
| 1.3 | 依存パッケージインストール | 2026-03-05 |
| 1.4 | ディレクトリ構造作成 | 2026-03-05 |
| 1.5 | スキーマ型定義 (version: "1.0") | 2026-03-05 |
| 1.6 | Skills スケルトン (3つ) | 2026-03-05 |
| 1.7 | Vitest 設定 | 2026-03-05 |
| 1.8 | 初期コミット | 2026-03-05 |
