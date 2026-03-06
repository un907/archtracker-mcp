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
  }
}

/**
 * C-style comments: // line comments and /* block comments *\/
 * Used by: Rust, Go, Java, C/C++, Swift, Kotlin
 * Also strips string literals ("..." and '...' for char literals)
 */
function stripCStyle(content: string): string {
  let result = "";
  let i = 0;
  while (i < content.length) {
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
 */
function stripPython(content: string): string {
  let result = "";
  let i = 0;
  while (i < content.length) {
    // Triple-quoted strings
    if (
      (content[i] === '"' && content[i + 1] === '"' && content[i + 2] === '"') ||
      (content[i] === "'" && content[i + 1] === "'" && content[i + 2] === "'")
    ) {
      const quote = content[i];
      const tripleQuote = quote + quote + quote;
      // Replace triple-quoted content with spaces
      result += "   ";
      i += 3;
      while (i < content.length) {
        if (content[i] === quote && content[i + 1] === quote && content[i + 2] === quote) {
          result += "   ";
          i += 3;
          break;
        }
        result += content[i] === "\n" ? "\n" : " ";
        i++;
      }
    }
    // Hash comment
    else if (content[i] === "#") {
      while (i < content.length && content[i] !== "\n") {
        result += " ";
        i++;
      }
    }
    // Single/double quoted strings (non-triple)
    else if (content[i] === '"' || content[i] === "'") {
      const quote = content[i];
      result += content[i];
      i++;
      while (i < content.length && content[i] !== quote) {
        if (content[i] === "\\" && i + 1 < content.length) {
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
 */
function stripRuby(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    if (!inBlock && line.startsWith("=begin")) {
      inBlock = true;
      result.push(" ".repeat(line.length));
      continue;
    }
    if (inBlock) {
      if (line.startsWith("=end")) {
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
        processed += " ".repeat(line.length - i);
        break;
      } else if (line[i] === '"') {
        processed += line[i]; i++;
        while (i < line.length && line[i] !== '"') {
          if (line[i] === "\\" && i + 1 < line.length) {
            processed += line[i++];
            processed += line[i++];
          } else {
            processed += line[i++];
          }
        }
        if (i < line.length) { processed += line[i]; i++; }
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
 * PHP comments: // line, /* block *\/, and # line
 */
function stripPhp(content: string): string {
  let result = "";
  let i = 0;
  while (i < content.length) {
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
