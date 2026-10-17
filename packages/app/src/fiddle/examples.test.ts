import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ErrorCode, FiddleError } from '../shared/errors';
import { SHOW_ME_EXAMPLES } from '../shared/examples';
import { findExample, loadExample } from './examples';

const staticDir = fileURLToPath(new URL('../../static', import.meta.url));

describe('Show Me examples', () => {
  it('lists the names in order', () => {
    expect(SHOW_ME_EXAMPLES).toHaveLength(29);
    expect(SHOW_ME_EXAMPLES[0]).toBe('App');
    expect(SHOW_ME_EXAMPLES.at(-1)).toBe('WebFrame');
    expect(SHOW_ME_EXAMPLES).toContain('utilityProcess');
  });

  it('has a bundled folder with a main.js for every example', () => {
    for (const name of SHOW_ME_EXAMPLES) {
      const main = path.join(staticDir, 'show-me', name.toLowerCase(), 'main.js');
      expect(existsSync(main), name).toBe(true);
    }
  });

  it('finds examples by name in any case', () => {
    expect(findExample('IPC')).toBe('IPC');
    expect(findExample('utilityprocess')).toBe('utilityProcess');
    expect(findExample('inapppurchase')).toBeUndefined();
    expect(findExample('../electron-quick-start')).toBeUndefined();
  });

  it('loads an example', async () => {
    const files = await loadExample(staticDir, 'IPC');
    expect(Object.keys(files).sort()).toEqual(['index.html', 'main.js', 'preload.js']);
  });

  it('loads every example', async () => {
    for (const name of SHOW_ME_EXAMPLES) {
      const files = await loadExample(staticDir, name);
      expect(files['main.js'], name).toBeTruthy();
    }
  });

  it('refuses unknown examples', async () => {
    await expect(loadExample(staticDir, '../show-me/app')).rejects.toBeInstanceOf(
      FiddleError,
    );
    await expect(loadExample(staticDir, 'Nope')).rejects.toMatchObject({
      code: ErrorCode.notFound,
    });
  });
});
