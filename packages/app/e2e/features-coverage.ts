#!/usr/bin/env node
// `yarn features-coverage [--strict]`: which Feature catalog IDs e2e specs cover
// (REQUIREMENTS §11, "Coverage").
//
// Specs reference a feature with `@feature <id>` in a test title or comment:
//   it('opens a second window @feature workspace.multi-window', ...)
//
// Stub: §17 bullets don't carry IDs yet. Once they do (proposed form: a
// trailing `{#workspace.multi-window}` on the bullet), catalogIds() returns
// them and --strict fails when any ID has no spec.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const requirements = path.resolve(e2eDir, '..', '..', '..', 'REQUIREMENTS.md');

function referencedIds(): Map<string, string[]> {
  const ids = new Map<string, string[]>();
  for (const file of fs.readdirSync(e2eDir).filter((name) => name.endsWith('.e2e.ts'))) {
    const content = fs.readFileSync(path.join(e2eDir, file), 'utf8');
    for (const match of content.matchAll(/@feature\s+([\w.-]+)/g)) {
      const id = match[1] ?? '';
      ids.set(id, [...new Set([...(ids.get(id) ?? []), file])]);
    }
  }
  return ids;
}

function catalogIds(): string[] {
  const text = fs.readFileSync(requirements, 'utf8');
  const catalog = text.slice(text.indexOf('## 17.'));
  return [...catalog.matchAll(/\{#([\w.-]+)\}/g)].map((match) => match[1] ?? '');
}

const referenced = referencedIds();
const catalog = catalogIds();
const uncovered = catalog.filter((id) => !referenced.has(id));
const unknown = [...referenced.keys()].filter((id) => catalog.length > 0 && !catalog.includes(id));

console.log(
  JSON.stringify(
    { catalog: catalog.length, referenced: Object.fromEntries(referenced), uncovered, unknown },
    null,
    2,
  ),
);
if (process.argv.includes('--strict') && (uncovered.length > 0 || unknown.length > 0)) {
  process.exit(1);
}
