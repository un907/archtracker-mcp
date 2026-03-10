/**
 * Escape a string for safe insertion into HTML.
 * Handles the 5 characters that can break HTML context:
 *   & < > " '
 *
 * Used both server-side (Node.js) and mirrored in browser-side
 * inline JS (template.ts `esc()`) with identical logic.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Returns the `esc()` function body as an inline JS string.
 * Ensures template.ts and unit tests use the exact same logic.
 */
export const ESC_FUNCTION_JS =
  `function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }`;
