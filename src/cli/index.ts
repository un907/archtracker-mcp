import { Command } from "commander";
import { analyzeProject, AnalyzerError } from "../analyzer/index.js";
import {
  saveSnapshot,
  loadSnapshot,
  computeDiff,
  formatDiffReport,
  StorageError,
} from "../storage/index.js";

const program = new Command();

program
  .name("archtracker")
  .description(
    "Architecture & Dependency Tracker — AI駆動開発のアーキテクチャ変更漏れを防止",
  )
  .version("0.1.0");

// ─── archtracker init ───────────────────────────────────────────

program
  .command("init")
  .description("プロジェクトの初期スナップショットを生成し .archtracker/ に保存")
  .option("-t, --target <dir>", "解析対象ディレクトリ", "src")
  .option("-r, --root <dir>", "プロジェクトルート", ".")
  .option(
    "-e, --exclude <patterns...>",
    "除外パターン（正規表現）",
  )
  .action(async (opts) => {
    try {
      console.log("解析中...");
      const graph = await analyzeProject(opts.target, {
        exclude: opts.exclude,
      });

      const snapshot = await saveSnapshot(opts.root, graph);

      console.log("✅ 初期スナップショットを保存しました");
      console.log(`  タイムスタンプ: ${snapshot.timestamp}`);
      console.log(`  ファイル数: ${graph.totalFiles}`);
      console.log(`  エッジ数: ${graph.totalEdges}`);

      if (graph.circularDependencies.length > 0) {
        console.log(
          `  ⚠ 循環参照: ${graph.circularDependencies.length}件`,
        );
      }

      // Show top 5 key components
      const top = Object.values(graph.files)
        .sort((a, b) => b.dependents.length - a.dependents.length)
        .slice(0, 5);

      if (top.length > 0 && top[0].dependents.length > 0) {
        console.log("\n主要コンポーネント:");
        for (const f of top) {
          if (f.dependents.length === 0) break;
          console.log(`  ${f.path} (${f.dependents.length}件が依存)`);
        }
      }
    } catch (error) {
      handleError(error);
    }
  });

// ─── archtracker check ─────────────────────────────────────────

program
  .command("check")
  .description(
    "スナップショットと現在のコードを比較し、変更の影響範囲を報告",
  )
  .option("-t, --target <dir>", "解析対象ディレクトリ", "src")
  .option("-r, --root <dir>", "プロジェクトルート", ".")
  .option("--ci", "CI モード: 影響ファイルがあれば exit code 1 で終了")
  .action(async (opts) => {
    try {
      const existingSnapshot = await loadSnapshot(opts.root);

      if (!existingSnapshot) {
        console.log(
          "スナップショットが見つかりません。`archtracker init` を先に実行してください。",
        );
        process.exit(1);
      }

      console.log("解析中...");
      const currentGraph = await analyzeProject(opts.target);
      const diff = computeDiff(existingSnapshot.graph, currentGraph);
      const report = formatDiffReport(diff);

      console.log(report);

      // CI mode: exit with error if there are affected dependents
      if (opts.ci && diff.affectedDependents.length > 0) {
        console.log(
          `\n❌ CI チェック失敗: ${diff.affectedDependents.length}件の要確認ファイルがあります`,
        );
        process.exit(1);
      }
    } catch (error) {
      handleError(error);
    }
  });

// ─── archtracker context ────────────────────────────────────────

program
  .command("context")
  .description(
    "現在のアーキテクチャコンテキストを表示（AI セッション初期化用）",
  )
  .option("-t, --target <dir>", "解析対象ディレクトリ", "src")
  .option("-r, --root <dir>", "プロジェクトルート", ".")
  .option("--json", "JSON 形式で出力")
  .action(async (opts) => {
    try {
      let snapshot = await loadSnapshot(opts.root);

      if (!snapshot) {
        console.log("スナップショットが無いため自動生成します...");
        const graph = await analyzeProject(opts.target);
        snapshot = await saveSnapshot(opts.root, graph);
      }

      const graph = snapshot.graph;

      if (opts.json) {
        const context = {
          validPaths: Object.keys(graph.files).sort(),
          snapshotTimestamp: snapshot.timestamp,
          totalFiles: graph.totalFiles,
          totalEdges: graph.totalEdges,
          circularDependencies: graph.circularDependencies.length,
          keyComponents: Object.values(graph.files)
            .sort((a, b) => b.dependents.length - a.dependents.length)
            .slice(0, 20)
            .map((f) => ({
              path: f.path,
              dependentCount: f.dependents.length,
              dependencyCount: f.dependencies.length,
            })),
        };
        console.log(JSON.stringify(context, null, 2));
        return;
      }

      console.log(`プロジェクト: ${graph.rootDir}`);
      console.log(`ファイル数: ${graph.totalFiles}`);
      console.log(`エッジ数: ${graph.totalEdges}`);
      console.log(`循環参照: ${graph.circularDependencies.length}件`);
      console.log(`スナップショット: ${snapshot.timestamp}`);

      console.log("\n有効なファイルパス:");
      for (const f of Object.keys(graph.files).sort()) {
        console.log(`  ${f}`);
      }
    } catch (error) {
      handleError(error);
    }
  });

// ─── Error handling ─────────────────────────────────────────────

function handleError(error: unknown): never {
  if (error instanceof AnalyzerError) {
    console.error(`❌ 解析エラー: ${error.message}`);
  } else if (error instanceof StorageError) {
    console.error(`❌ ストレージエラー: ${error.message}`);
  } else if (error instanceof Error) {
    console.error(`❌ エラー: ${error.message}`);
  } else {
    console.error(`❌ 予期しないエラー: ${String(error)}`);
  }
  process.exit(1);
}

program.parse();
