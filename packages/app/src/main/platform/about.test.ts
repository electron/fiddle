import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

const setAboutPanelOptions = vi.fn();
vi.mock('electron', () => ({
  app: {
    getName: () => 'Electron Fiddle',
    getVersion: () => '1.2.3',
    getAppPath: () => '/nowhere',
    setAboutPanelOptions: (...args: unknown[]) => setAboutPanelOptions(...args),
  },
}));
vi.mock('../i18n', () => ({ tm: () => (key: string) => key }));

const { contributorNames, setupAboutPanel } = await import('./about');

describe('contributorNames', () => {
  it('reads the shape tools/release-data.mjs writes, preferring a name over the login', () => {
    const data = {
      schemaVersion: 1,
      source: 'https://api.github.com/repos/electron/fiddle/contributors',
      contributors: [
        { login: 'octocat', url: 'https://github.com/octocat', contributions: 9 },
        {
          login: 'hubot',
          name: ' Hubot H. ',
          url: 'https://github.com/hubot',
          contributions: 1,
        },
      ],
    };
    expect(contributorNames(data)).toEqual(['octocat', 'Hubot H.']);
  });

  it('accepts a bare array, and skips entries without a label', () => {
    expect(
      contributorNames([
        { login: 'a' },
        { name: '  ', login: 'b' },
        { name: 'C' },
        {},
        null,
        'x',
        3,
      ]),
    ).toEqual(['a', 'b', 'C']);
  });

  it('is empty for anything else', () => {
    for (const junk of [
      undefined,
      null,
      'x',
      3,
      {},
      { contributors: 'nope' },
      { contributors: {} },
    ]) {
      expect(contributorNames(junk)).toEqual([]);
    }
  });
});

describe('setupAboutPanel', () => {
  it('lists the bundled contributors', () => {
    setupAboutPanel();
    expect(setAboutPanelOptions).toHaveBeenCalledTimes(1);
    const options = setAboutPanelOptions.mock.calls[0]![0] as {
      authors: string[];
      credits: string;
      website: string;
    };
    const bundled: unknown = JSON.parse(
      fs.readFileSync(
        path.join(import.meta.dirname, '../../../static/contributors.json'),
        'utf8',
      ),
    );
    const names = contributorNames(bundled);
    expect(names.length).toBeGreaterThan(0);
    expect(options.authors).toEqual(names);
    expect(options.credits).toBe(names.join(', '));
    expect(options.website).toBe('https://electronjs.org/fiddle');
  });
});
