/**
 * Patch dependency-cruiser's CJS files that use Node.js subpath imports (#*)
 * which fail on Windows + Node.js v22 due to CJS loader not resolving
 * the imports field correctly.
 *
 * See: https://github.com/sverweij/dependency-cruiser/issues/XXXX
 */
const fs = require("node:fs");
const path = require("node:path");

const TARGET = path.join(
  __dirname,
  "..",
  "node_modules",
  "dependency-cruiser",
  "src",
  "extract",
  "transpile",
  "vue-template-wrap.cjs"
);

if (fs.existsSync(TARGET)) {
  let content = fs.readFileSync(TARGET, "utf8");
  let patched = false;

  if (content.includes('require("#utl/try-require.cjs")')) {
    content = content.replace(
      'require("#utl/try-require.cjs")',
      'require("../../utl/try-require.cjs")'
    );
    patched = true;
  }

  if (content.includes('require("#meta.cjs")')) {
    content = content.replace(
      'require("#meta.cjs")',
      'require("../../meta.cjs")'
    );
    patched = true;
  }

  if (patched) {
    fs.writeFileSync(TARGET, content);
  }
}
