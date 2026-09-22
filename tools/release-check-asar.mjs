#!/usr/bin/env node
// `node tools/release-check-asar.mjs [outDir] [--test-build]` (default packages/app/out) fails if
// test-only code was packaged. Asar archives store files uncompressed, so a byte
// search finds any bundled string. When outDir/test-build exists (after `yarn test:e2e`),
// it also fails for a marker the test build lacks, which would leave it guarding nothing;
// `--test-build` makes a missing test build a failure too.
import fs from 'node:fs';
import path from 'node:path';

// Strings that only test-build code contains.
const MARKERS = [
  // src/main/test-driver
  'ELECTRON_FIDDLE_DRIVER_SOCKET',
  'Accessibility.getFullAXTree',
  'non-loopback request',
  // src/main/test-mode.ts, behind TEST_BUILD
  'FIDDLE_TEST_MODE',
  'FIDDLE_TEST_DIR',
  'FIDDLE_TEST_FIXTURE_URL',
  'FIDDLE_TEST_MENUBAR',
];

const args = process.argv.slice(2).filter((arg) => arg !== '--test-build');
const outDir = path.resolve(
  args[0] ?? path.join(import.meta.dirname, '..', 'packages', 'app', 'out'),
);

function* find(dir, keep) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    // Dirents for symlinks (macOS framework links) are not directories, so this never loops.
    if (entry.isDirectory()) yield* find(full, keep);
    else if (entry.isFile() && keep(entry.name)) yield full;
  }
}

const asars = fs.existsSync(outDir)
  ? [...find(outDir, (name) => name === 'app.asar')]
  : [];
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

const testBuild = path.join(outDir, 'test-build');
if (fs.existsSync(testBuild)) {
  const contents = [...find(testBuild, (name) => !name.endsWith('.map'))].map((file) =>
    fs.readFileSync(file),
  );
  const missing = MARKERS.filter(
    (marker) => !contents.some((bytes) => bytes.includes(marker)),
  );
  if (missing.length > 0) {
    failed = true;
    console.error(`FAIL ${testBuild}: marker guards nothing (${missing.join(', ')})`);
  } else {
    console.log(`ok   ${testBuild}: has all ${MARKERS.length} markers`);
  }
} else if (process.argv.includes('--test-build')) {
  failed = true;
  console.error(`FAIL ${testBuild}: no test build to check the markers against`);
} else {
  console.log(`skip ${testBuild}: no test build to check the markers against`);
}
process.exit(failed ? 1 : 0);
