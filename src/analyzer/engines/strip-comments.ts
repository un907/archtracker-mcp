import type { CommentStyle } from "./types.js";

/**
 * Strip comments and string literals from source code.
 * Replaces them with whitespace to preserve line numbers and positions.
 */
export function stripComments(content: string, style: CommentStyle): string {
  switch (style) {
    case "c-style":
      return stripCStyle(content);
    case "hash":
      return stripHash(content);
    case "python":
      return stripPython(content);
    case "ruby":
      return stripRuby(content);
    case "php":
      return stripPhp(content);
    default: {
      const _exhaustive: never = style;
      throw new Error(`Unknown comment style: ${_exhaustive}`);
    }
  }
}

/**
 * C-style comments: // line comments and /* block comments *\/
 * Used by: Rust, Go, Java, C/C++, Swift, Kotlin
 * Also strips string literals ("..." and '...' for char literals)
 * Handles Rust raw strings: r"...", r#"..."#, r##"..."## etc.
 */
function stripCStyle(content: string): string {
  let result = "";
  let i = 0;
  while (i < content.length) {
    // Rust raw strings: r"...", r#"..."#, r##"..."##, etc.
    if (content[i] === "r" && i + 1 < content.length) {
      let hashes = 0;
      let j = i + 1;
      while (j < content.length && content[j] === "#") {
        hashes++;
        j++;
      }
      if (j < content.length && content[j] === '"') {
        // This is a raw string: r"...", r#"..."#, etc.
        // Replace entire raw string content with spaces
        // Replace r, hashes, and opening quote with spaces
        for (let k = i; k <= j; k++) {
          result += " ";
        }
        i = j + 1; // move past opening quote
        // Scan for closing pattern
        while (i < content.length) {
          if (content[i] === '"') {
            // Check if followed by correct number of hashes
            let matchHashes = 0;
            let m = i + 1;
            while (m < content.length && content[m] === "#" && matchHashes < hashes) {
              matchHashes++;
              m++;
            }
            if (matchHashes === hashes) {
              // Found the closing delimiter
              for (let k = i; k < m; k++) {
                result += " ";
              }
              i = m;
              break;
            }
          }
          result += content[i] === "\n" ? "\n" : " ";
          i++;
        }
        continue;
      }
      // Not a raw string, fall through to normal character handling
    }

    // Single-line comment
    if (content[i] === "/" && content[i + 1] === "/") {
      // Skip to end of line, preserve newline
      while (i < content.length && content[i] !== "\n") {
        result += " ";
        i++;
      }
    }
    // Block comment
    else if (content[i] === "/" && content[i + 1] === "*") {
      result += " ";
      i++; // /
      result += " ";
      i++; // *
      while (i < content.length) {
        if (content[i] === "*" && content[i + 1] === "/") {
          result += " ";
          i++;
          result += " ";
          i++;
          break;
        }
        // Preserve newlines for line-number accuracy
        result += content[i] === "\n" ? "\n" : " ";
        i++;
      }
    }
    // Double-quoted string
    else if (content[i] === '"') {
      result += content[i]; // keep the quote
      i++;
      while (i < content.length && content[i] !== '"') {
        if (content[i] === "\\" && i + 1 < content.length) {
          result += content[i]; // backslash
          i++;
          result += content[i]; // escaped char
          i++;
        } else if (content[i] === "\n") {
          result += "\n";
          i++;
        } else {
          result += content[i];
          i++;
        }
      }
      if (i < content.length) {
        result += content[i]; // closing quote
        i++;
      }
    }
    // Single-quoted char literal (e.g. '/', '\'', '\\', '\n')
    else if (content[i] === "'") {
      result += content[i]; // opening quote
      i++;
      while (i < content.length && content[i] !== "'") {
        if (content[i] === "\\" && i + 1 < content.length) {
          result += content[i]; // backslash
          i++;
          result += content[i]; // escaped char
          i++;
        } else {
          result += content[i];
          i++;
        }
      }
      if (i < content.length) {
        result += content[i]; // closing quote
        i++;
      }
    }
    // Raw/backtick string (Go)
    else if (content[i] === "`") {
      result += " "; // replace backtick string content
      i++;
      while (i < content.length && content[i] !== "`") {
        result += content[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < content.length) {
        result += " ";
        i++;
      }
    }
    // Normal character
    else {
      result += content[i];
      i++;
    }
  }
  return result;
}

/**
 * Hash-style comments: # line comments
 * Used by: (standalone, though mostly via python/ruby)
 */
function stripHash(content: string): string {
  let result = "";
  let i = 0;
  while (i < content.length) {
    if (content[i] === "#") {
      while (i < content.length && content[i] !== "\n") {
        result += " ";
        i++;
      }
    } else if (content[i] === '"') {
      result += content[i];
      i++;
      while (i < content.length && content[i] !== '"') {
        if (content[i] === "\\" && i + 1 < content.length) {
          result += content[i++];
          result += content[i++];
        } else {
          result += content[i++];
        }
      }
      if (i < content.length) { result += content[i]; i++; }
    } else if (content[i] === "'") {
      result += content[i];
      i++;
      while (i < content.length && content[i] !== "'") {
        if (content[i] === "\\" && i + 1 < content.length) {
          result += content[i++];
          result += content[i++];
        } else {
          result += content[i++];
        }
      }
      if (i < content.length) { result += content[i]; i++; }
    } else {
      result += content[i];
      i++;
    }
  }
  return result;
}

/**
 * Python comments: # line comments + triple-quoted strings (""" and ''')
 * Handles string prefixes: r, b, f, rb, fr, br (case-insensitive)
 * For raw strings (r prefix), backslash is NOT treated as escape.
 */
function stripPython(content: string): string {
  let result = "";
  let i = 0;
  while (i < content.length) {
    // Check for string prefix (r, b, f, rb, fr, br) before quotes
    let prefixLen = 0;
    let isRaw = false;
    if (i < content.length) {
      const c0 = content[i];
      const c1 = i + 1 < content.length ? content[i + 1] : "";
      const c2 = i + 2 < content.length ? content[i + 2] : "";
      // Two-char prefixes: rb, br, fr, rf
      if (
        (c0 === "r" || c0 === "R" || c0 === "b" || c0 === "B" || c0 === "f" || c0 === "F") &&
        (c1 === "r" || c1 === "R" || c1 === "b" || c1 === "B" || c1 === "f" || c1 === "F") &&
        (c2 === '"' || c2 === "'")
      ) {
        // Validate it's a real two-char prefix (rb, br, fr, rf)
        const pair = (c0 + c1).toLowerCase();
        if (pair === "rb" || pair === "br" || pair === "fr" || pair === "rf") {
          prefixLen = 2;
          isRaw = pair.includes("r");
        }
      }
      // Single-char prefix: r, b, f
      if (
        prefixLen === 0 &&
        (c0 === "r" || c0 === "R" || c0 === "b" || c0 === "B" || c0 === "f" || c0 === "F") &&
        (c1 === '"' || c1 === "'")
      ) {
        prefixLen = 1;
        isRaw = c0 === "r" || c0 === "R";
      }
    }

    const quoteStart = i + prefixLen;

    // Triple-quoted strings (with or without prefix)
    if (
      quoteStart + 2 < content.length &&
      (content[quoteStart] === '"' || content[quoteStart] === "'") &&
      content[quoteStart + 1] === content[quoteStart] &&
      content[quoteStart + 2] === content[quoteStart]
    ) {
      const quote = content[quoteStart];
      // Output prefix chars
      for (let k = 0; k < prefixLen; k++) {
        result += " ";
      }
      // Replace triple-quoted content with spaces
      result += "   ";
      i = quoteStart + 3;
      while (i < content.length) {
        if (content[i] === quote && content[i + 1] === quote && content[i + 2] === quote) {
          result += "   ";
          i += 3;
          break;
        }
        if (!isRaw && content[i] === "\\" && i + 1 < content.length) {
          result += " ";
          i++;
          result += content[i] === "\n" ? "\n" : " ";
          i++;
        } else {
          result += content[i] === "\n" ? "\n" : " ";
          i++;
        }
      }
    }
    // Hash comment
    else if (prefixLen === 0 && content[i] === "#") {
      while (i < content.length && content[i] !== "\n") {
        result += " ";
        i++;
      }
    }
    // Single/double quoted strings (non-triple), with or without prefix
    else if (
      quoteStart < content.length &&
      (content[quoteStart] === '"' || content[quoteStart] === "'") &&
      (prefixLen > 0 || content[i] === '"' || content[i] === "'")
    ) {
      const quote = content[quoteStart];
      // Output prefix
      for (let k = i; k < quoteStart; k++) {
        result += content[k];
      }
      result += content[quoteStart]; // opening quote
      i = quoteStart + 1;
      while (i < content.length && content[i] !== quote) {
        if (!isRaw && content[i] === "\\" && i + 1 < content.length) {
          result += content[i++];
          result += content[i++];
        } else if (content[i] === "\n") {
          result += "\n";
          i++;
          break; // unterminated string
        } else {
          result += content[i++];
        }
      }
      if (i < content.length && content[i] === quote) { result += content[i]; i++; }
    }
    else {
      result += content[i];
      i++;
    }
  }
  return result;
}

/**
 * Ruby comments: # line comments + =begin/=end block comments
 * Handles string interpolation #{} inside double-quoted strings.
 */
function stripRuby(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    if (!inBlock && /^=begin(\s|$)/.test(line)) {
      inBlock = true;
      result.push(" ".repeat(line.length));
      continue;
    }
    if (inBlock) {
      if (/^=end(\s|$)/.test(line)) {
        inBlock = false;
      }
      result.push(" ".repeat(line.length));
      continue;
    }

    // Process line for # comments (respecting strings)
    let processed = "";
    let i = 0;
    while (i < line.length) {
      if (line[i] === "#") {
        // Outside of any string, this is a comment
        processed += " ".repeat(line.length - i);
        break;
      } else if (line[i] === '"') {
        processed += line[i]; i++;
        processed = scanRubyDoubleQuotedString(line, i, processed);
        i = (scanRubyDoubleQuotedStringIndex(line, i));
      } else if (line[i] === "'") {
        processed += line[i]; i++;
        while (i < line.length && line[i] !== "'") {
          if (line[i] === "\\" && i + 1 < line.length) {
            processed += line[i++];
            processed += line[i++];
          } else {
            processed += line[i++];
          }
        }
        if (i < line.length) { processed += line[i]; i++; }
      } else {
        processed += line[i]; i++;
      }
    }
    result.push(processed);
  }

  return result.join("\n");
}

/**
 * Scans a Ruby double-quoted string body starting at position i (after the opening "),
 * handling #{} interpolation. Returns the resulting processed string content appended to `processed`.
 */
function scanRubyDoubleQuotedString(line: string, startI: number, processed: string): string {
  let i = startI;
  while (i < line.length && line[i] !== '"') {
    if (line[i] === "\\" && i + 1 < line.length) {
      processed += line[i++];
      processed += line[i++];
    } else if (line[i] === "#" && i + 1 < line.length && line[i + 1] === "{") {
      // String interpolation: #{...}
      processed += line[i++]; // #
      processed += line[i++]; // {
      let depth = 1;
      while (i < line.length && depth > 0) {
        if (line[i] === "{") {
          depth++;
          processed += line[i++];
        } else if (line[i] === "}") {
          depth--;
          processed += line[i++];
        } else if (line[i] === "\\" && i + 1 < line.length) {
          processed += line[i++];
          processed += line[i++];
        } else {
          processed += line[i++];
        }
      }
    } else {
      processed += line[i++];
    }
  }
  if (i < line.length) { processed += line[i]; /* closing " */ }
  return processed;
}

/**
 * Returns the index after scanning a Ruby double-quoted string body starting at startI.
 */
function scanRubyDoubleQuotedStringIndex(line: string, startI: number): number {
  let i = startI;
  while (i < line.length && line[i] !== '"') {
    if (line[i] === "\\" && i + 1 < line.length) {
      i += 2;
    } else if (line[i] === "#" && i + 1 < line.length && line[i + 1] === "{") {
      i += 2; // skip #{
      let depth = 1;
      while (i < line.length && depth > 0) {
        if (line[i] === "{") {
          depth++;
          i++;
        } else if (line[i] === "}") {
          depth--;
          i++;
        } else if (line[i] === "\\" && i + 1 < line.length) {
          i += 2;
        } else {
          i++;
        }
      }
    } else {
      i++;
    }
  }
  if (i < line.length) { i++; /* skip closing " */ }
  return i;
}

/**
 * PHP comments: // line, /* block *\/, and # line
 * Also handles heredoc (<<<IDENTIFIER) and nowdoc (<<<'IDENTIFIER').
 */
function stripPhp(content: string): string {
  let result = "";
  let i = 0;
  while (i < content.length) {
    // Heredoc / Nowdoc: <<<IDENTIFIER or <<<'IDENTIFIER'
    if (content[i] === "<" && content[i + 1] === "<" && content[i + 2] === "<") {
      const heredocStart = i;
      let j = i + 3;
      let isNowdoc = false;
      // Skip optional whitespace after <<<
      // Check for nowdoc (single-quoted identifier)
      if (j < content.length && content[j] === "'") {
        isNowdoc = true;
        j++; // skip opening '
      }
      // Read identifier
      const identStart = j;
      while (j < content.length && /[A-Za-z0-9_]/.test(content[j])) {
        j++;
      }
      const identifier = content.slice(identStart, j);
      if (identifier.length > 0) {
        // For nowdoc, skip the closing '
        if (isNowdoc && j < content.length && content[j] === "'") {
          j++;
        }
        // Check for optional semicolon and newline (or just newline) to validate this is heredoc syntax
        // We need at least a newline after the identifier line
        let validHeredoc = false;
        let lineEnd = j;
        // There might be a semicolon and/or other chars before newline, but typically just newline
        if (lineEnd < content.length && content[lineEnd] === "\n") {
          validHeredoc = true;
        }
        if (validHeredoc) {
          // Output the heredoc opening line as-is (<<<IDENTIFIER or <<<'IDENTIFIER')
          for (let k = heredocStart; k <= lineEnd; k++) {
            if (content[k] === "\n") {
              result += "\n";
            } else {
              result += content[k];
            }
          }
          i = lineEnd + 1; // move past the newline
          // Now scan for the closing identifier on its own line
          // The closing identifier may optionally be followed by ; and must be at end of line
          let found = false;
          while (i < content.length && !found) {
            // Check if current line starts with the identifier
            const lineStart = i;
            // Read the current line
            let lineEndIdx = i;
            while (lineEndIdx < content.length && content[lineEndIdx] !== "\n") {
              lineEndIdx++;
            }
            const currentLine = content.slice(lineStart, lineEndIdx);
            // PHP 7.3+ allows indented heredoc closing, but we check trimmed
            const trimmedLine = currentLine.trimStart();
            if (
              trimmedLine === identifier ||
              trimmedLine === identifier + ";" ||
              trimmedLine === identifier + "," ||
              trimmedLine === identifier + ");" ||
              trimmedLine === identifier + ")" ||
              trimmedLine.startsWith(identifier + ";") ||
              trimmedLine === identifier
            ) {
              // This is the closing line - output it as-is
              for (let k = lineStart; k < lineEndIdx; k++) {
                result += content[k];
              }
              i = lineEndIdx;
              if (i < content.length && content[i] === "\n") {
                result += "\n";
                i++;
              }
              found = true;
            } else {
              // Body line: replace content with spaces, preserve newlines
              for (let k = lineStart; k < lineEndIdx; k++) {
                result += " ";
              }
              i = lineEndIdx;
              if (i < content.length && content[i] === "\n") {
                result += "\n";
                i++;
              }
            }
          }
          continue;
        }
      }
      // If not a valid heredoc, just output the < and continue
      result += content[i];
      i++;
      continue;
    }

    // Single-line comments (// or #)
    if ((content[i] === "/" && content[i + 1] === "/") || content[i] === "#") {
      while (i < content.length && content[i] !== "\n") {
        result += " ";
        i++;
      }
    }
    // Block comments
    else if (content[i] === "/" && content[i + 1] === "*") {
      result += " "; i++;
      result += " "; i++;
      while (i < content.length) {
        if (content[i] === "*" && content[i + 1] === "/") {
          result += " "; i++;
          result += " "; i++;
          break;
        }
        result += content[i] === "\n" ? "\n" : " ";
        i++;
      }
    }
    // Double-quoted string
    else if (content[i] === '"') {
      result += content[i]; i++;
      while (i < content.length && content[i] !== '"') {
        if (content[i] === "\\" && i + 1 < content.length) {
          result += content[i++];
          result += content[i++];
        } else {
          result += content[i++];
        }
      }
      if (i < content.length) { result += content[i]; i++; }
    }
    // Single-quoted string
    else if (content[i] === "'") {
      result += content[i]; i++;
      while (i < content.length && content[i] !== "'") {
        if (content[i] === "\\" && i + 1 < content.length) {
          result += content[i++];
          result += content[i++];
        } else {
          result += content[i++];
        }
      }
      if (i < content.length) { result += content[i]; i++; }
    }
    else {
      result += content[i]; i++;
    }
  }
  return result;
}
