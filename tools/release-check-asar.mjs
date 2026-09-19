#!/usr/bin/env node
// `node tools/release-check-asar.mjs [outDir]` (default packages/app/out) fails if
// test-only code was packaged. Asar archives store files uncompressed, so a byte
// search finds any bundled string.
import fs from 'node:fs';
import path from 'node:path';

import { MARKERS } from './release-markers.mjs';

const outDir = path.resolve(
  process.argv[2] ?? path.join(import.meta.dirname, '..', 'packages', 'app', 'out'),
);

function* findAsars(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    // Dirents for symlinks (macOS framework links) are not directories, so this never loops.
    if (entry.isDirectory()) yield* findAsars(full);
    else if (entry.isFile() && entry.name === 'app.asar') yield full;
  }
}

const asars = fs.existsSync(outDir) ? [...findAsars(outDir)] : [];
if (asars.length === 0) {
  console.error(`No app.asar found under ${outDir}. Package the app first.`);
  process.exit(1);
}

let failed = false;
for (const asar of asars) {
  const bytes = fs.readFileSync(asar);
  const found = MARKERS.filter((marker) => bytes.includes(marker));
  if (found.length > 0) {
    failed = true;
    console.error(`FAIL ${asar}: contains test-only code (${found.join(', ')})`);
  } else {
    console.log(`ok   ${asar}`);
  }
}
process.exit(failed ? 1 : 0);
