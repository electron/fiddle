import { describe, expect, it } from 'vitest';

import { ErrorCode } from '../shared/errors';
import { loadDocsExample } from './docs-examples';
import type { RepoContentEntry } from './github';

const template = { 'main.js': '// template main', 'preload.js': '// template preload', 'index.html': '<template/>' };

function fakeGitHub(entries: RepoContentEntry[]) {
  const listed: unknown[][] = [];
  const fetched: string[] = [];
  return {
    listed,
    fetched,
    github: {
      async listRepoDirectory(...args: unknown[]) {
        listed.push(args.slice(0, 4));
        return entries;
      },
      async fetchText(url: string) {
        fetched.push(url);
        return `content of ${url.split('/').pop()}`;
      },
    },
  };
}

const file = (name: string, type = 'file'): RepoContentEntry => ({
  name,
  path: `docs/fiddles/x/${name}`,
  type,
  downloadUrl: type === 'file' ? `https://raw.githubusercontent.com/electron/electron/v30.0.0/docs/fiddles/x/${name}` : null,
});

describe('loadDocsExample', () => {
  it('lays supported files over the template for the tag version', async () => {
    const fake = fakeGitHub([file('main.js'), file('index.html'), file('README.md'), file('package.json'), file('assets', 'dir')]);
    const versions: string[] = [];
    const result = await loadDocsExample({
      tag: 'v30.0.0',
      path: 'docs/fiddles/x',
      github: fake.github,
      getTemplate: async (version) => {
        versions.push(version);
        return template;
      },
    });
    expect(versions).toEqual(['30.0.0']);
    expect(fake.listed).toEqual([['electron', 'electron', 'docs/fiddles/x', 'v30.0.0']]);
    expect(fake.fetched).toHaveLength(2);
    expect(result).toEqual({
      version: '30.0.0',
      files: { 'main.js': 'content of main.js', 'preload.js': '// template preload', 'index.html': 'content of index.html' },
      origin: { kind: 'electron', tag: 'v30.0.0', path: 'docs/fiddles/x' },
    });
  });

  it('adds a main entry if neither side has one', async () => {
    const fake = fakeGitHub([file('renderer.js')]);
    const result = await loadDocsExample({ tag: '29.0.0', path: 'a', github: fake.github, getTemplate: async () => ({}) });
    expect(Object.keys(result.files).sort()).toEqual(['main.js', 'renderer.js']);
  });

  it.each(['main', 'vfoo', 'v30'])('rejects the tag %s', async (tag) => {
    const fake = fakeGitHub([]);
    await expect(loadDocsExample({ tag, path: 'a', github: fake.github, getTemplate: async () => template })).rejects.toMatchObject({
      code: ErrorCode.invalidArgument,
      details: { reason: 'invalid-tag' },
    });
  });

  it.each(['', 'docs/../x', './docs', 'docs//x', 'docs\\x'])('rejects the path %j', async (p) => {
    const fake = fakeGitHub([]);
    await expect(
      loadDocsExample({ tag: 'v30.0.0', path: p, github: fake.github, getTemplate: async () => template }),
    ).rejects.toMatchObject({ details: { reason: 'invalid-path' } });
    expect(fake.listed).toHaveLength(0);
  });
});
