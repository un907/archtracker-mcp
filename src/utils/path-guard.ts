import { resolve } from "node:path";

/**
 * Validate that a path resolves within the allowed boundary (CWD by default).
 * Prevents path traversal attacks via ../../../etc/passwd style inputs.
 */
export function validatePath(
  inputPath: string,
  boundary?: string,
): string {
  const resolved = resolve(inputPath);
  const root = boundary ? resolve(boundary) : process.cwd();

  if (!resolved.startsWith(root)) {
    throw new PathTraversalError(
      `パスがプロジェクトルートの外部を指しています: "${inputPath}" → "${resolved}" (許可範囲: "${root}")`,
    );
  }
  return resolved;
}

export class PathTraversalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathTraversalError";
  }
}
