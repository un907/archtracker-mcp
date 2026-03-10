import { describe, it, expect } from "vitest";
import { escapeHtml, ESC_FUNCTION_JS } from "./html-escape.js";

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("a&b")).toBe("a&amp;b");
  });

  it("escapes less-than", () => {
    expect(escapeHtml("a<b")).toBe("a&lt;b");
  });

  it("escapes greater-than", () => {
    expect(escapeHtml("a>b")).toBe("a&gt;b");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('a"b')).toBe("a&quot;b");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("a'b")).toBe("a&#39;b");
  });

  it("leaves safe strings unchanged", () => {
    expect(escapeHtml("hello world 123")).toBe("hello world 123");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("escapes all dangerous characters together", () => {
    expect(escapeHtml(`<script>alert("xss")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    );
  });

  it("escapes XSS via attribute injection", () => {
    // Attacker tries: ' onclick='alert(1)
    expect(escapeHtml("' onclick='alert(1)")).toBe(
      "&#39; onclick=&#39;alert(1)",
    );
  });

  it("escapes XSS via innerHTML context", () => {
    // Attacker tries: <img src=x onerror=alert(1)>
    expect(escapeHtml("<img src=x onerror=alert(1)>")).toBe(
      "&lt;img src=x onerror=alert(1)&gt;",
    );
  });

  it("handles multiple ampersands without double-escaping", () => {
    expect(escapeHtml("a&b&c")).toBe("a&amp;b&amp;c");
    // Escaping already-escaped string would double-escape
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });

  it("handles unicode and multibyte characters", () => {
    expect(escapeHtml("日本語<テスト>")).toBe("日本語&lt;テスト&gt;");
    expect(escapeHtml("émojis 🎉 & fun")).toBe("émojis 🎉 &amp; fun");
  });

  it("handles file paths with special characters", () => {
    // Real-world archtracker use case: file paths as node labels
    expect(escapeHtml("src/components/Button.tsx")).toBe(
      "src/components/Button.tsx",
    );
    expect(escapeHtml("lib/<internal>/index.ts")).toBe(
      "lib/&lt;internal&gt;/index.ts",
    );
  });
});

describe("ESC_FUNCTION_JS", () => {
  it("produces a valid JS function string", () => {
    expect(ESC_FUNCTION_JS).toContain("function esc(s)");
    expect(ESC_FUNCTION_JS).toContain("replace");
  });

  it("inline JS matches escapeHtml behavior", () => {
    // Evaluate the inline JS function and compare with Node-side implementation
    // eslint-disable-next-line no-new-func
    const esc = new Function("s", ESC_FUNCTION_JS.replace("function esc(s) {", "").replace(/}$/, "")) as (s: string) => string;

    const testCases = [
      "",
      "hello",
      "<script>alert('xss')</script>",
      'a"b\'c&d<e>f',
      "日本語<テスト>",
      "path/to/file.ts",
    ];

    for (const input of testCases) {
      expect(esc(input)).toBe(escapeHtml(input));
    }
  });
});
