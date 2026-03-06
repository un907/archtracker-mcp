/**
 * CLI & integration robustness tests — 導入後に起きうる問題
 *
 * - CLI --language バリデーション
 * - CLI に存在しないディレクトリを渡した場合
 * - VERSION の正しさ
 * - パストラバーサル防止
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { rmSync, existsSync, readFileSync } from "node:fs";
import { VERSION } from "../utils/version.js";
import { LANGUAGE_IDS } from "../analyzer/engines/types.js";
import { validatePath, PathTraversalError } from "../utils/path-guard.js";

const CLI = join(import.meta.dirname, "..", "..", "dist", "cli", "index.js");
const TEST_ROOT = join(import.meta.dirname, "..", "..", ".e2e-robust-tmp");

function run(args: string, opts?: { expectError?: boolean }): string {
  try {
    return execSync(`node ${CLI} ${args}`, {
      cwd: TEST_ROOT,
      encoding: "utf-8",
      env: { ...process.env, LANG: "en_US.UTF-8" },
      timeout: 30000,
    });
  } catch (error: unknown) {
    if (opts?.expectError && error && typeof error === "object" && "stderr" in error) {
      return (error as { stderr: string }).stderr;
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════
// 1. VERSION の正しさ
// ═══════════════════════════════════════════════════════

describe("VERSION consistency", () => {
  it("VERSION matches package.json", () => {
    const pkg = JSON.parse(
      readFileSync(join(import.meta.dirname, "..", "..", "package.json"), "utf-8"),
    );
    expect(VERSION).toBe(pkg.version);
  });

  it("VERSION is a valid semver string", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("LANGUAGE_IDS count matches expectations", () => {
    // If someone adds a language but forgets to update this, it catches the drift
    expect(LANGUAGE_IDS.length).toBe(13);
  });
});

// ═══════════════════════════════════════════════════════
// 2. CLI --version と --help
// ═══════════════════════════════════════════════════════

describe("CLI basic flags", () => {
  beforeAll(() => {
    if (!existsSync(TEST_ROOT)) {
      execSync(`mkdir -p ${TEST_ROOT}`);
    }
  });

  afterAll(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  });

  it("--version outputs correct version", () => {
    const output = run("--version");
    expect(output.trim()).toBe(VERSION);
  });

  it("--help shows available commands", () => {
    const output = run("--help");
    expect(output).toContain("init");
    expect(output).toContain("analyze");
    expect(output).toContain("check");
    expect(output).toContain("context");
    expect(output).toContain("serve");
    expect(output).toContain("ci-setup");
  });

  it("analyze --help shows --language option", () => {
    const output = run("analyze --help");
    expect(output).toContain("--language");
    expect(output).toContain("javascript");
    expect(output).toContain("python");
    expect(output).toContain("rust");
  });
});

// ═══════════════════════════════════════════════════════
// 3. CLI --language バリデーション
// ═══════════════════════════════════════════════════════

describe("CLI --language validation", () => {
  beforeAll(() => {
    if (!existsSync(TEST_ROOT)) {
      execSync(`mkdir -p ${TEST_ROOT}`);
    }
  });

  afterAll(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  });

  it("rejects invalid language", () => {
    const output = run("analyze --language invalid_lang --target .", { expectError: true });
    expect(output).toContain("Invalid language");
    expect(output).toContain("Valid languages");
  });

  it("rejects empty language string", () => {
    // Commander will treat --language without arg as an error
    const output = run("analyze --language", { expectError: true });
    expect(output.length).toBeGreaterThan(0); // Some error output
  });
});

// ═══════════════════════════════════════════════════════
// 4. CLI に存在しないディレクトリを渡した場合
// ═══════════════════════════════════════════════════════

describe("CLI with nonexistent target", () => {
  beforeAll(() => {
    if (!existsSync(TEST_ROOT)) {
      execSync(`mkdir -p ${TEST_ROOT}`);
    }
  });

  afterAll(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  });

  it("analyze exits with error for nonexistent dir", () => {
    expect(() => {
      run("analyze --target /nonexistent/path/12345");
    }).toThrow();
  });

  it("init exits with error for nonexistent dir", () => {
    expect(() => {
      run("init --target /nonexistent/path/12345");
    }).toThrow();
  });
});

// ═══════════════════════════════════════════════════════
// 5. パストラバーサル防止
// ═══════════════════════════════════════════════════════

describe("path traversal protection", () => {
  it("rejects ../../../etc/passwd", () => {
    expect(() => validatePath("../../../etc/passwd")).toThrow(PathTraversalError);
  });

  it("rejects /etc/passwd (absolute outside project)", () => {
    expect(() => validatePath("/etc/passwd")).toThrow(PathTraversalError);
  });

  it("allows normal relative paths", () => {
    expect(() => validatePath("src")).not.toThrow();
    expect(() => validatePath("src/analyzer")).not.toThrow();
    expect(() => validatePath(".")).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════
// 6. package.json の整合性
// ═══════════════════════════════════════════════════════

describe("package.json integrity", () => {
  const pkg = JSON.parse(
    readFileSync(join(import.meta.dirname, "..", "..", "package.json"), "utf-8"),
  );

  it("does NOT depend on dependency-cruiser", () => {
    expect(pkg.dependencies["dependency-cruiser"]).toBeUndefined();
  });

  it("does NOT require typescript as peerDependency", () => {
    expect(pkg.peerDependencies?.typescript).toBeUndefined();
  });

  it("bin points to correct entry points", () => {
    expect(pkg.bin.archtracker).toBe("dist/cli/index.js");
    expect(pkg.bin["archtracker-mcp"]).toBe("dist/mcp/index.js");
  });

  it("exports are properly configured", () => {
    expect(pkg.exports["."]).toBeDefined();
    expect(pkg.exports["./mcp"]).toBeDefined();
  });
});
