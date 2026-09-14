#!/usr/bin/env node
// `yarn features-coverage [--strict] [--json]`: which Feature catalog IDs have
// a test (REQUIREMENTS §11, "Coverage").
//
// Catalog IDs are the trailing `{#section.name}` markers in REQUIREMENTS §17.
// Tests reference one with `@feature <id>`, in an e2e test title or in a
// comment next to a unit test (several IDs may follow one `@feature`):
//   it('opens a second window @feature workspace.multi-window', ...)
//   // @feature files.no-duplicates files.reserved-names
//   it('checks adds', ...)
//
// It scans packages/app/e2e/*.e2e.ts and every *.test.{ts,tsx,mjs} under
// packages/. It always fails on duplicate catalog IDs and on tags that name no
// catalog ID; --strict also fails when any ID has no test.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(e2eDir, '..', '..', '..');
const ID = /[a-z0-9]+(?:\.[a-z0-9-]+)+/;
const SKIP = new Set(['node_modules', 'out', '.vite', 'dist', 'generated']);

/** Every test file: e2e specs and unit tests. */
function testFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return SKIP.has(entry.name) ? [] : testFiles(full);
    return /\.(e2e\.ts|test\.(ts|tsx|mjs))$/.test(entry.name) ? [full] : [];
  });
}

/** ID -> the files that reference it, split by kind. */
function referencedIds(): Map<string, { e2e: string[]; unit: string[] }> {
  const ids = new Map<string, { e2e: string[]; unit: string[] }>();
  // Spaces, tabs and commas only: a comment's IDs never run onto the next line.
  const tag = new RegExp(`@feature((?:[ \\t,]+${ID.source})+)`, 'g');
  for (const file of testFiles(path.join(root, 'packages'))) {
    const relative = path.relative(root, file);
    const kind = file.endsWith('.e2e.ts') ? 'e2e' : 'unit';
    for (const match of fs.readFileSync(file, 'utf8').matchAll(tag)) {
      for (const id of (match[1] ?? '').split(/[\s,]+/).filter(Boolean)) {
        const entry = ids.get(id) ?? { e2e: [], unit: [] };
        if (!entry[kind].includes(relative)) entry[kind].push(relative);
        ids.set(id, entry);
      }
    }
  }
  return ids;
}

/** Catalog IDs in document order. */
function catalogIds(): string[] {
  const text = fs.readFileSync(path.join(root, 'REQUIREMENTS.md'), 'utf8');
  const catalog = text.slice(text.indexOf('## 17. Feature catalog'));
  return [...catalog.matchAll(/\{#([\w.-]+)\}/g)].map((match) => match[1] ?? '');
}

const referenced = referencedIds();
const catalog = catalogIds();
const duplicates = [...new Set(catalog.filter((id, index) => catalog.indexOf(id) !== index))];
const known = new Set(catalog);
const unknown = [...referenced.keys()].filter((id) => !known.has(id)).sort();
const covered = catalog.filter((id) => referenced.has(id));
const uncovered = catalog.filter((id) => !referenced.has(id));
const e2eCount = catalog.filter((id) => (referenced.get(id)?.e2e.length ?? 0) > 0).length;
const unitOnly = covered.length - e2eCount;

const bySection = (ids: string[]) => {
  const groups: Record<string, string[]> = {};
  for (const id of ids) (groups[id.split('.')[0] ?? ''] ??= []).push(id);
  return groups;
};

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(
      {
        total: catalog.length,
        covered: covered.length,
        coveredByE2e: e2eCount,
        coveredByUnitOnly: unitOnly,
        uncovered: bySection(uncovered),
        unknown,
        duplicates,
        referenced: Object.fromEntries(referenced),
      },
      null,
      2,
    ),
  );
} else {
  const percent = catalog.length ? Math.round((covered.length / catalog.length) * 100) : 0;
  console.log(
    `Feature coverage: ${covered.length}/${catalog.length} IDs (${percent}%): ` +
      `${e2eCount} with an e2e spec, ${unitOnly} with unit tests only.`,
  );
  const groups = Object.entries(bySection(uncovered));
  if (groups.length > 0) {
    console.log(`\nUncovered (${uncovered.length}):`);
    for (const [section, ids] of groups) console.log(`  ${section} (${ids.length}): ${ids.join(', ')}`);
  }
  if (unknown.length > 0) console.log(`\nTags that name no catalog ID: ${unknown.join(', ')}`);
  if (duplicates.length > 0) console.log(`\nDuplicate catalog IDs: ${duplicates.join(', ')}`);
}

const strict = process.argv.includes('--strict');
if (unknown.length > 0 || duplicates.length > 0 || (strict && uncovered.length > 0)) {
  process.exit(1);
}
