// npm packages: search the fixture Algolia index, add, change, remove and save.
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { makeFolder, readJson, role, useApp, windowState } from './harness.ts';

describe('packages', () => {
  const app = useApp();
  const modules = async () => (await windowState(app())).fiddle.modules;
  /** Closes the suggestions, which stay open after a package is added. */
  const closeSuggestions = async () => {
    if ((await app().snapshot(0)).includes('listbox "Suggestions"')) await app().press('Escape');
    await app().waitForAbsent(role('listbox', 'Suggestions'));
  };
  const add = async (query: string, name: string) => {
    await app().type(query, role('combobox', 'Add a package from npm'));
    await app().click(role('option', new RegExp(`^${name}\\b`)));
    await closeSuggestions();
  };

  it('searches npm and adds the chosen package at its latest version @feature modules.search modules.add', async () => {
    await app().type('left', role('combobox', 'Add a package from npm'));
    await app().query(role('option', /^left-pad\b/));
    // Debounced: one search for the pause, not one per key.
    const searches = app.fixtures().requests.filter((r) => r.path.startsWith('/algolia/'));
    expect(searches.length).toBeGreaterThan(0);
    expect(searches.length).toBeLessThan(4);

    await app().click(role('option', /^left-pad\b/));
    await expect.poll(modules).toEqual({ 'left-pad': '1.1.0' });
    await closeSuggestions();
    await app().query(role('list', 'Packages in this fiddle'));
    expect((await windowState(app())).fiddle.dirty).toBe(true);
  });

  it('changes a package version and removes the package @feature modules.edit', async () => {
    await app().click(role('button', /Version of left-pad/));
    await app().click(role('option', /^1\.0\.0\b/));
    await expect.poll(modules).toEqual({ 'left-pad': '1.0.0' });
    await app().click(role('button', 'Remove left-pad'));
    await expect.poll(modules).toEqual({});
  });

  it('saves packages as dependencies @feature files.pkg-deps', async () => {
    await add('lodash', 'lodash');
    await expect.poll(modules).toEqual({ lodash: '1.1.0' });
    const dir = path.join(makeFolder(app(), 'packages-parent'), 'with-lodash');
    await app().queueDialog('open', { filePaths: [dir] });
    await app().press('CmdOrCtrl+S');
    await expect.poll(async () => (await windowState(app())).fiddle.dirty).toBe(false);
    expect(readJson<{ dependencies?: Record<string, string> }>(path.join(dir, 'package.json')).dependencies).toEqual({
      lodash: '1.1.0',
    });
  });
});
