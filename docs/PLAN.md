# ArchTracker MCP — 実装計画書

## 目的
AI駆動開発における「アーキテクチャ変更時の修正漏れ」と「セッション跨ぎの記憶喪失」を防ぐ統合システム。

## フェーズ一覧

| Phase | 内容 | 状態 | 成果物 |
|-------|------|------|--------|
| 1 | プロジェクトセットアップ | ✅ 完了 | 骨格、ビルドパイプライン、スキーマ定義、Skills スケルトン |
| 2 | Analyzer（依存関係解析器）実装 | ✅ 完了 | `src/analyzer/` — dependency-cruiser 連携、6テスト |
| 3 | Storage（記憶層）実装 | ✅ 完了 | `src/storage/` — snapshot 永続化 + diff 計算、10テスト |
| 4 | MCP サーバー実装 | ✅ 完了 | `src/mcp/` — 4ツール登録、stdio トランスポート |
| 5 | CLI + Skills 統合 | ✅ 完了 | `src/cli/` + `skills/` + プラグイン構成 |
| 6 | テスト・品質保証 | ⬚ 未着手 | E2E テスト、エラーハンドリング強化 |
| 7 | OSS リリース準備 | ⬚ 未着手 | README、LICENSE、npm publish 設定 |

## 技術選定

| カテゴリ | 選定 | 理由 |
|----------|------|------|
| 言語 | TypeScript (ESM) | MCP SDK が TS ファースト |
| ビルド | tsup | ESM/CJS 地獄を回避、シバン自動付与 |
| AST 解析 | dependency-cruiser | TS/JS 特化、実績あり |
| バリデーション | Zod | MCP SDK が Zod 前提 |
| CLI | Commander | 軽量、デファクト |
| テスト | Vitest | 高速、ESM ネイティブ |
| スキーマ | 独自 JSON (version: "1.0") | 後方互換性を最初から担保 |

## 対象言語
- TypeScript / JavaScript のみ（dependency-cruiser のフル活用）

## 懸念事項と対策

| 懸念 | 対策 | 実装状態 |
|------|------|----------|
| ESM/CJS 地獄 | tsup で単一 ESM 出力に統一 | ✅ |
| クソデカ Repo で OOM | maxDepth/exclude オプション | ✅ |
| スキーマ破壊的変更 | version フィールドでマイグレーション対応 | ✅ |
| dependency-cruiser の tsconfig 不在 | エラーハンドリングで明確なメッセージ | ✅ |
| 循環参照 | 検出して警告（クラッシュさせない） | ✅ |
