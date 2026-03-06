import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import type {
  DependencyGraph,
  DependencyEdge,
  FileNode,
} from "../../types/schema.js";
import type { AnalyzerEngine, LanguageConfig } from "./types.js";
import { detectCycles } from "./cycle.js";
import { stripComments } from "./strip-comments.js";

export class RegexEngine implements AnalyzerEngine {
  constructor(private config: LanguageConfig) {}

  async analyze(
    rootDir: string,
    options: { exclude?: string[]; maxDepth?: number } = {},
  ): Promise<DependencyGraph> {
    const absRootDir = resolve(rootDir);
    const excludePatterns = [
      ...(this.config.defaultExclude ?? []),
      ...(options.exclude ?? []),
      "\\.archtracker",
    ].map((p) => new RegExp(p));

    // 1. Collect all matching files
    const projectFiles = await this.collectFiles(
      absRootDir,
      absRootDir,
      excludePatterns,
      options.maxDepth ?? 0,
    );

    const projectFileSet = new Set(projectFiles);

    // 2. Extract imports and resolve edges
    const files: Record<string, FileNode> = {};
    const edges: DependencyEdge[] = [];
    const edgeSet = new Set<string>(); // "source\0target" for dedup

    // Initialize all file nodes
    for (const filePath of projectFiles) {
      const relPath = relative(absRootDir, filePath);
      files[relPath] = {
        path: relPath,
        exists: true,
        dependencies: [],
        dependents: [],
      };
    }

    // Process each file for imports
    for (const filePath of projectFiles) {
      const relSource = relative(absRootDir, filePath);
      let content: string;
      try {
        content = await readFile(filePath, "utf-8");
      } catch {
        if (files[relSource]) files[relSource].exists = false;
        continue;
      }

      const stripped = stripComments(content, this.config.commentStyle);
      const imports = this.extractImports(stripped, filePath, absRootDir, projectFileSet);
      for (const importPath of imports) {
        const resolved = this.config.resolveImport(
          importPath,
          filePath,
          absRootDir,
          projectFileSet,
        );
        if (!resolved) continue;

        const relTarget = relative(absRootDir, resolved);
        if (!files[relTarget]) continue; // skip external
        if (relSource === relTarget) continue; // skip self-import

        const edgeKey = `${relSource}\0${relTarget}`;
        if (edgeSet.has(edgeKey)) continue; // deduplicate
        edgeSet.add(edgeKey);

        edges.push({
          source: relSource,
          target: relTarget,
          type: "static",
        });

        files[relSource].dependencies.push(relTarget);
        files[relTarget].dependents.push(relSource);
      }
    }

    // 3. Detect cycles
    const circularDependencies = detectCycles(edges);

    return {
      rootDir: absRootDir,
      files,
      edges,
      circularDependencies,
      totalFiles: Object.keys(files).length,
      totalEdges: edges.length,
    };
  }

  private extractImports(
    content: string,
    filePath: string,
    rootDir: string,
    projectFiles: Set<string>,
  ): string[] {
    // Use custom extractor if defined (e.g., Rust grouped use, C# class refs)
    if (this.config.extractImports) {
      return this.config.extractImports(content, filePath, rootDir, projectFiles);
    }

    const imports: string[] = [];
    for (const pattern of this.config.importPatterns) {
      // Reset regex state, ensuring 'g' flag is present to prevent infinite loops
      const flags = pattern.regex.flags.includes('g') ? pattern.regex.flags : pattern.regex.flags + 'g';
      const regex = new RegExp(pattern.regex.source, flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        // Use the first capturing group as the import path
        if (match[1]) {
          imports.push(match[1]);
        }
      }
    }
    return imports;
  }

  private async collectFiles(
    dir: string,
    absRootDir: string,
    excludePatterns: RegExp[],
    maxDepth: number,
    currentDepth: number = 0,
  ): Promise<string[]> {
    if (maxDepth > 0 && currentDepth >= maxDepth) return [];

    const results: string[] = [];
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(absRootDir, fullPath);

      // Check excludes against the entry name and relative path
      if (
        excludePatterns.some(
          (p) => p.test(entry.name) || p.test(relPath) || p.test(fullPath),
        )
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        if (entry.name.startsWith(".")) continue;
        const sub = await this.collectFiles(
          fullPath,
          absRootDir,
          excludePatterns,
          maxDepth,
          currentDepth + 1,
        );
        results.push(...sub);
      } else if (entry.isFile()) {
        const dotIdx = entry.name.lastIndexOf(".");
        if (dotIdx > 0) {
          const ext = entry.name.slice(dotIdx);
          if (this.config.extensions.includes(ext)) {
            results.push(fullPath);
          }
        }
      }
    }

    return results;
  }
}
