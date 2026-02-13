/**
 * Post-build script: Add .js extensions to relative imports in dist/
 * Fixes Node.js ESM requirement for explicit file extensions.
 * tsc outputs `from "./index"` but Node ESM needs `from "./index.js"`
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";

async function fixImports(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });

  for (const entry of entries) {
    if (!entry.isFile() || extname(entry.name) !== ".js") continue;

    const filePath = join(entry.parentPath || entry.path, entry.name);
    let content = await readFile(filePath, "utf-8");
    let changed = false;

    // Fix relative imports/exports: from "./foo" → from "./foo.js"
    const fixed = content.replace(
      /(from\s+["'])(\.\.?\/[^"']+)(["'])/g,
      (match, prefix, importPath, suffix) => {
        // Skip if already has .js or .json extension
        if (importPath.endsWith(".js") || importPath.endsWith(".json")) return match;
        changed = true;
        return `${prefix}${importPath}.js${suffix}`;
      },
    );

    if (changed) {
      await writeFile(filePath, fixed);
    }
  }

  console.log("[fix-esm-imports] Done — .js extensions added to relative imports in dist/");
}

fixImports("./dist").catch(console.error);
