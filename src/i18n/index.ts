export type Locale = "en" | "ja";

let currentLocale: Locale = detectLocale();

/** Get the current locale */
export function getLocale(): Locale {
  return currentLocale;
}

/** Set the locale explicitly */
export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

/** Auto-detect locale from LANG/LC_ALL environment variable */
function detectLocale(): Locale {
  const env = process.env.LC_ALL || process.env.LANG || "";
  if (env.startsWith("ja")) return "ja";
  return "en";
}

/** Get a translated message by key */
export function t(key: string, vars?: Record<string, string | number>): string {
  const messages = currentLocale === "ja" ? ja : en;
  let msg = (messages as Record<string, string>)[key] ?? (en as Record<string, string>)[key] ?? key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      msg = msg.replaceAll(`{${k}}`, String(v));
    }
  }
  return msg;
}

// ─── Message catalogs ───────────────────────────────────────────

const en = {
  // Analyzer
  "analyzer.failed": "dependency-cruiser failed: {message}",
  "analyzer.exitCode": "Analysis finished with error code {code}",

  // Storage
  "storage.parseFailed": "Failed to parse snapshot.json. File may be corrupted: {path}",
  "storage.readFailed": "Failed to read snapshot.json: {path}",
  "storage.invalidSchema": "snapshot.json schema is invalid. Please regenerate with `archtracker init`:\n{issues}",
  "storage.versionMismatch": "snapshot.json version ({version}) is incompatible with current schema ({expected}). Regenerate with `archtracker init`.",

  // Path guard
  "pathGuard.traversal": "Path points outside project root: \"{input}\" → \"{resolved}\" (allowed: \"{boundary}\")",

  // Diff report
  "diff.title": "# Architecture Change Report\n",
  "diff.noChanges": "No changes — snapshot matches current code.\n",
  "diff.added": "## Added Files ({count})",
  "diff.removed": "## Removed Files ({count})",
  "diff.modified": "## Modified Dependencies ({count})",
  "diff.affected": "## Files Requiring Review ({count})",
  "diff.reasonRemoved": "Dependency \"{file}\" was removed",
  "diff.reasonModified": "Dependency \"{file}\" had its dependencies changed",
  "diff.reasonAdded": "New dependency \"{file}\" was added",

  // Search
  "search.pathMatch": "Path matches \"{pattern}\"",
  "search.affected": "May be affected by changes to \"{file}\" (via: {via})",
  "search.critical": "{count} files depend on this component",
  "search.orphan": "Orphan file (no dependencies, no dependents)",
  "search.noResults": "No results: \"{query}\" (mode: {mode})",
  "search.results": "Results: {count} (mode: {mode})",

  // CLI
  "cli.analyzing": "Analyzing...",
  "cli.snapshotSaved": "Snapshot saved",
  "cli.timestamp": "  Timestamp: {ts}",
  "cli.fileCount": "  Files: {count}",
  "cli.edgeCount": "  Edges: {count}",
  "cli.circularCount": "  Circular deps: {count}",
  "cli.keyComponents": "\nKey components:",
  "cli.dependedBy": "{path} ({count} dependents)",
  "cli.noSnapshot": "No snapshot found. Run `archtracker init` first.",
  "cli.ciFailed": "\nCI check failed: {count} file(s) require review",
  "cli.autoGenerating": "No snapshot found, auto-generating...",
  "cli.project": "Project: {path}",
  "cli.validPaths": "\nValid file paths:",
  "cli.snapshot": "Snapshot: {ts}",

  // MCP
  "mcp.analyzeComplete": "Analysis complete: {files} files, {edges} edges",
  "mcp.circularFound": "Circular deps: {count} found",
  "mcp.circularNone": "Circular deps: none",
  "mcp.snapshotSaved": "Snapshot saved",
  "mcp.autoInit": "No snapshot existed. Initial snapshot auto-generated.",
  "mcp.nextCheckEnabled": "Diff checking will be active from the next run.",
  "mcp.queryRequired": "\"{mode}\" mode requires the query parameter",

  // Analyze report
  "analyze.title": "# Architecture Analysis Report\n",
  "analyze.overview": "## Overview",
  "analyze.totalFiles": "  Total files: {count}",
  "analyze.totalEdges": "  Total edges: {count}",
  "analyze.totalCircular": "  Circular dependencies: {count}",
  "analyze.criticalTitle": "\n## Critical Components (Top {count})",
  "analyze.criticalItem": "  {path} ({count} dependents)",
  "analyze.circularTitle": "\n## Circular Dependencies ({count})",
  "analyze.circularItem": "  {files}",
  "analyze.orphanTitle": "\n## Orphan Files ({count})",
  "analyze.couplingTitle": "\n## High Coupling (Top {count} by import count)",
  "analyze.couplingItem": "  {path} ({count} imports)",
  "analyze.layerTitle": "\n## Directory Breakdown",
  "analyze.layerItem": "  {dir}/ — {count} files",
  "analyze.noIssues": "\nNo architectural issues detected.",
  "analyze.snapshotSaved": "\nSnapshot saved alongside analysis.",

  // CI
  "ci.generated": "GitHub Actions workflow generated: {path}",

  // Web viewer
  "web.starting": "Starting architecture viewer...",
  "web.listening": "Architecture graph available at: http://localhost:{port}",
  "web.stop": "Press Ctrl+C to stop",
  "web.watching": "Watching {dir}/ for changes...",
  "web.reloading": "File change detected, reloading...",
  "web.reloaded": "Graph reloaded",

  // Errors
  "error.analyzer": "[Analysis Error] {message}",
  "error.storage": "[Storage Error] {message}",
  "error.pathTraversal": "[Security Error] {message}",
  "error.generic": "[Error] {message}",
  "error.unexpected": "[Error] Unexpected error: {message}",
  "error.cli.analyzer": "Analysis error: {message}",
  "error.cli.storage": "Storage error: {message}",
  "error.cli.generic": "Error: {message}",
  "error.cli.unexpected": "Unexpected error: {message}",
} as const;

const ja = {
  // Analyzer
  "analyzer.failed": "dependency-cruiser の実行に失敗しました: {message}",
  "analyzer.exitCode": "解析がエラーコード {code} で終了しました",

  // Storage
  "storage.parseFailed": "snapshot.json のパースに失敗しました。ファイルが破損している可能性があります: {path}",
  "storage.readFailed": "snapshot.json の読み取りに失敗しました: {path}",
  "storage.invalidSchema": "snapshot.json のスキーマが不正です。archtracker init で再生成してください:\n{issues}",
  "storage.versionMismatch": "snapshot.json のバージョン ({version}) が現在のスキーマ ({expected}) と互換性がありません。archtracker init で再生成してください。",

  // Path guard
  "pathGuard.traversal": "パスがプロジェクトルートの外部を指しています: \"{input}\" → \"{resolved}\" (許可範囲: \"{boundary}\")",

  // Diff report
  "diff.title": "# アーキテクチャ変更レポート\n",
  "diff.noChanges": "変更なし — スナップショットと現在のコードは一致しています。\n",
  "diff.added": "## 追加されたファイル ({count}件)",
  "diff.removed": "## 削除されたファイル ({count}件)",
  "diff.modified": "## 依存関係が変更されたファイル ({count}件)",
  "diff.affected": "## 確認が必要なファイル ({count}件)",
  "diff.reasonRemoved": "依存先 \"{file}\" が削除されました",
  "diff.reasonModified": "依存先 \"{file}\" の依存関係が変更されました",
  "diff.reasonAdded": "新しい依存先 \"{file}\" が追加されました",

  // Search
  "search.pathMatch": "パスが \"{pattern}\" にマッチ",
  "search.affected": "\"{file}\" の変更により影響を受ける可能性（経由: {via}）",
  "search.critical": "{count}件のファイルが依存する重要コンポーネント",
  "search.orphan": "孤立ファイル（依存なし・被依存なし）",
  "search.noResults": "検索結果なし: \"{query}\" (モード: {mode})",
  "search.results": "検索結果: {count}件 (モード: {mode})",

  // CLI
  "cli.analyzing": "解析中...",
  "cli.snapshotSaved": "スナップショットを保存しました",
  "cli.timestamp": "  タイムスタンプ: {ts}",
  "cli.fileCount": "  ファイル数: {count}",
  "cli.edgeCount": "  エッジ数: {count}",
  "cli.circularCount": "  循環参照: {count}件",
  "cli.keyComponents": "\n主要コンポーネント:",
  "cli.dependedBy": "{path} ({count}件が依存)",
  "cli.noSnapshot": "スナップショットが見つかりません。`archtracker init` を先に実行してください。",
  "cli.ciFailed": "\nCI チェック失敗: {count}件の要確認ファイルがあります",
  "cli.autoGenerating": "スナップショットが無いため自動生成します...",
  "cli.project": "プロジェクト: {path}",
  "cli.validPaths": "\n有効なファイルパス:",
  "cli.snapshot": "スナップショット: {ts}",

  // MCP
  "mcp.analyzeComplete": "解析完了: {files}ファイル, {edges}エッジ",
  "mcp.circularFound": "循環参照: {count}件検出",
  "mcp.circularNone": "循環参照: なし",
  "mcp.snapshotSaved": "スナップショットを保存しました",
  "mcp.autoInit": "スナップショットが存在しなかったため、初期スナップショットを自動生成しました。",
  "mcp.nextCheckEnabled": "次回の実行時から差分チェックが有効になります。",
  "mcp.queryRequired": "\"{mode}\" モードでは query パラメータが必須です",

  // Analyze report
  "analyze.title": "# アーキテクチャ分析レポート\n",
  "analyze.overview": "## 概要",
  "analyze.totalFiles": "  総ファイル数: {count}",
  "analyze.totalEdges": "  総エッジ数: {count}",
  "analyze.totalCircular": "  循環参照: {count}件",
  "analyze.criticalTitle": "\n## 重要コンポーネント (上位{count}件)",
  "analyze.criticalItem": "  {path} ({count}件が依存)",
  "analyze.circularTitle": "\n## 循環参照 ({count}件)",
  "analyze.circularItem": "  {files}",
  "analyze.orphanTitle": "\n## 孤立ファイル ({count}件)",
  "analyze.couplingTitle": "\n## 高結合ファイル (import数 上位{count}件)",
  "analyze.couplingItem": "  {path} ({count}件をimport)",
  "analyze.layerTitle": "\n## ディレクトリ構成",
  "analyze.layerItem": "  {dir}/ — {count}ファイル",
  "analyze.noIssues": "\nアーキテクチャ上の問題は検出されませんでした。",
  "analyze.snapshotSaved": "\n分析と同時にスナップショットを保存しました。",

  // CI
  "ci.generated": "GitHub Actions ワークフローを生成しました: {path}",

  // Web viewer
  "web.starting": "アーキテクチャビューアーを起動中...",
  "web.listening": "アーキテクチャグラフ: http://localhost:{port}",
  "web.stop": "Ctrl+C で停止",
  "web.watching": "{dir}/ を監視中...",
  "web.reloading": "ファイル変更を検出、リロード中...",
  "web.reloaded": "グラフを更新しました",

  // Errors
  "error.analyzer": "[解析エラー] {message}",
  "error.storage": "[ストレージエラー] {message}",
  "error.pathTraversal": "[セキュリティエラー] {message}",
  "error.generic": "[エラー] {message}",
  "error.unexpected": "[エラー] 予期しないエラーが発生しました: {message}",
  "error.cli.analyzer": "解析エラー: {message}",
  "error.cli.storage": "ストレージエラー: {message}",
  "error.cli.generic": "エラー: {message}",
  "error.cli.unexpected": "予期しないエラー: {message}",
} as const;
