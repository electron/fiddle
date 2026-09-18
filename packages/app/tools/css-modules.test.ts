import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'gallery' ? [] : sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const withoutComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const definedClasses = (path: string) =>
  new Set(
    [...withoutComments(readFileSync(path, 'utf8')).matchAll(/\.([A-Za-z_][\w-]*)/g)].map(
      (match) => match[1]!,
    ),
  );

describe('CSS modules', () => {
  it('define every class the components read from them', () => {
    const missing: string[] = [];
    for (const file of ['ui', 'renderer'].flatMap((dir) => sources(join(SRC, dir)))) {
      const code = withoutComments(readFileSync(file, 'utf8'));
      const uses = code.replace(/^import .*\.module\.css';$/gm, '');
      for (const [, alias, specifier] of code.matchAll(
        /import\s+(\w+)\s+from\s+'([^']+\.module\.css)'/g,
      )) {
        const defined = definedClasses(resolve(dirname(file), specifier!));
        for (const use of uses.matchAll(
          new RegExp(`\\b${alias}\\.(\\w+)|\\b${alias}\\['([\\w-]+)'\\]`, 'g'),
        )) {
          const name = use[1] ?? use[2]!;
          if (!defined.has(name))
            missing.push(
              `${relative(SRC, file)}: ${alias}.${name} is not in ${specifier}`,
            );
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
