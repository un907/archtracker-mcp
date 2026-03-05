# Contributing to archtracker-mcp

Thank you for your interest in contributing! / コントリビュートに興味を持っていただきありがとうございます！

[日本語版はこちら](#日本語)

## Getting Started

1. Fork and clone the repository

```bash
git clone https://github.com/un907/archtracker-mcp.git
cd archtracker-mcp
```

2. Install dependencies

```bash
npm install
```

3. Build and test

```bash
npm run build
npm test
```

## Development

```bash
npm run dev          # Watch mode build
npm run test:watch   # Watch mode tests
npm run typecheck    # Type checking
```

### Project Structure

```
src/
  analyzer/    # Dependency analysis (dependency-cruiser wrapper)
  cli/         # CLI commands (commander)
  e2e/         # End-to-end tests
  i18n/        # Internationalization (en/ja)
  mcp/         # MCP server (Model Context Protocol)
  storage/     # Snapshot save/load/diff
  types/       # TypeScript type definitions
  utils/       # Shared utilities
  web/         # Web viewer (template + server)
skills/        # Claude Code Skills
```

## How to Contribute

### Bug Reports

Open an [issue](https://github.com/un907/archtracker-mcp/issues) with:
- Steps to reproduce
- Expected vs actual behavior
- Node.js version and OS

### Feature Requests

Open an [issue](https://github.com/un907/archtracker-mcp/issues) with the "enhancement" label.

### Pull Requests

1. Create a feature branch from `main`
2. Write tests for new functionality
3. Ensure all tests pass: `npm test`
4. Ensure types check: `npm run typecheck`
5. Submit a PR with a clear description

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new MCP tool for dependency depth analysis
fix: correct circular dependency detection for re-exports
docs: update CLI usage examples
test: add E2E tests for web viewer
```

### i18n

When adding user-facing strings:
1. Add the English key to `src/i18n/index.ts` in the `en` object
2. Add the Japanese translation in the `ja` object
3. For web viewer strings, also add to the `I18N` object in `src/web/template.ts`

## Code Style

- TypeScript strict mode
- ESM modules (`import`/`export`)
- Prefer `const` over `let`
- No unused variables or imports

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

<a id="日本語"></a>

# archtracker-mcp へのコントリビュート

## はじめに

1. リポジトリをフォーク＆クローン

```bash
git clone https://github.com/un907/archtracker-mcp.git
cd archtracker-mcp
```

2. 依存関係をインストール

```bash
npm install
```

3. ビルド＆テスト

```bash
npm run build
npm test
```

## 開発

```bash
npm run dev          # ウォッチモードビルド
npm run test:watch   # ウォッチモードテスト
npm run typecheck    # 型チェック
```

## コントリビュートの方法

### バグ報告

[Issue](https://github.com/un907/archtracker-mcp/issues) を作成してください：
- 再現手順
- 期待される動作と実際の動作
- Node.js バージョンと OS

### 機能リクエスト

"enhancement" ラベル付きの [Issue](https://github.com/un907/archtracker-mcp/issues) を作成してください。

### プルリクエスト

1. `main` からフィーチャーブランチを作成
2. 新機能にはテストを記述
3. 全テストの通過を確認: `npm test`
4. 型チェックの通過を確認: `npm run typecheck`
5. 明確な説明付きの PR を提出

### i18n（多言語対応）

ユーザー向け文字列を追加する場合：
1. `src/i18n/index.ts` の `en` オブジェクトに英語キーを追加
2. `ja` オブジェクトに日本語翻訳を追加
3. Web ビューア用の文字列は `src/web/template.ts` の `I18N` オブジェクトにも追加

## ライセンス

コントリビュートすることで、あなたの貢献が MIT ライセンスの下でライセンスされることに同意したものとみなされます。
