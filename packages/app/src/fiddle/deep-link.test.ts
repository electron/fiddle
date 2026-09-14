import { describe, expect, it } from 'vitest';

import { type DeepLink, findDeepLinkInArgv, isDeepLink, parseDeepLink, versionFromTag } from './deep-link';

const ID = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';
const SHA = '0123456789abcdef0123456789abcdef01234567';

/** Real-world link shapes: docs "Open in Fiddle" links and gist links with and without an owner. */
const valid: [string, DeepLink][] = [
  [`electron-fiddle://gist/${ID}`, { kind: 'gist', id: ID }],
  [`electron-fiddle://gist/ckerr/${ID}`, { kind: 'gist', id: ID, owner: 'ckerr' }],
  [`electron-fiddle://gist/some-user/${ID}/`, { kind: 'gist', id: ID, owner: 'some-user' }],
  [`ELECTRON-FIDDLE://GIST/${ID.toUpperCase()}`, { kind: 'gist', id: ID }],
  [`electron-fiddle://gist/${ID}?revision=${SHA}`, { kind: 'gist', id: ID, revision: SHA }],
  [`electron-fiddle://gist/${ID}?revision=${SHA.toUpperCase()}&x=1`, { kind: 'gist', id: ID, revision: SHA }],
  [`electron-fiddle://gist/${ID}?foo=bar#fragment`, { kind: 'gist', id: ID }],
  [`electron-fiddle://gist/${ID}/#top`, { kind: 'gist', id: ID }],
  [
    'electron-fiddle://electron/v30.0.0/docs/fiddles/quick-start',
    { kind: 'electron', tag: 'v30.0.0', version: '30.0.0', path: 'docs/fiddles/quick-start' },
  ],
  [
    'electron-fiddle://electron/v22.0.0-beta.1/docs/fiddles/features/web-bluetooth',
    { kind: 'electron', tag: 'v22.0.0-beta.1', version: '22.0.0-beta.1', path: 'docs/fiddles/features/web-bluetooth' },
  ],
  [
    'electron-fiddle://electron/v27.0.0/docs/fiddles/menus/customize-menus/',
    { kind: 'electron', tag: 'v27.0.0', version: '27.0.0', path: 'docs/fiddles/menus/customize-menus' },
  ],
  [
    'electron-fiddle://Electron/28.1.0/docs/fiddles/ipc/pattern-3?revision=ignored',
    { kind: 'electron', tag: '28.1.0', version: '28.1.0', path: 'docs/fiddles/ipc/pattern-3' },
  ],
];

const invalid = [
  `electron-fiddle://gist/${ID.slice(1)}`,
  `electron-fiddle://gist/${ID}0`,
  `electron-fiddle://gist/${'g'.repeat(32)}`,
  `electron-fiddle://gist/a/b/${ID}`,
  'electron-fiddle://gist',
  'electron-fiddle://gist/',
  `electron-fiddle://gist/-bad/${ID}`,
  `electron-fiddle://gist/bad-/${ID}`,
  `electron-fiddle://gist/two--dashes/${ID}`,
  `electron-fiddle://gist/${'a'.repeat(40)}/${ID}`,
  `electron-fiddle://gist/${ID}?revision=abc`,
  `electron-fiddle://gist/${ID}?revision=`,
  `electron-fiddle://gist//${ID}`,
  `electron-fiddle://gist/${ID}//`,
  'electron-fiddle://electron/v30.0.0',
  'electron-fiddle://electron/v30.0.0/',
  'electron-fiddle://electron/vfoo/docs/x',
  'electron-fiddle://electron/=30.0.0/docs/x',
  'electron-fiddle://electron/V30.0.0/docs/x',
  'electron-fiddle://electron/30/docs/x',
  'electron-fiddle://electron/v30.0.0/docs/../secret',
  'electron-fiddle://electron/v30.0.0/./docs',
  'electron-fiddle://electron/v30.0.0/docs//fiddles',
  'electron-fiddle://electron/v30.0.0/docs/%2e%2e/x',
  'electron-fiddle://electron/v30.0.0/docs%2Ffiddles',
  'electron-fiddle://electron/v30.0.0/docs%2ffiddles',
  'electron-fiddle://electron/v30.0.0/docs%5Cfiddles',
  'electron-fiddle://electron/v30.0.0/docs\\fiddles',
  'electron-fiddle://electron/v30.0.0/docs/%zz',
  'electron-fiddle://electron/v30.0.0/docs/a b',
  'electron-fiddle:///gist',
  'electron-fiddle:gist/x',
  `https://gist.github.com/${ID}`,
  '',
];

describe('parseDeepLink', () => {
  // @feature load.deep-link new.deep-link-revision
  it.each(valid)('parses %s', (url, link) => {
    expect(parseDeepLink(url)).toEqual({ ok: true, url, link });
  });

  it.each(invalid)('rejects %j and names the link', (url) => {
    expect(parseDeepLink(url)).toEqual({ ok: false, url, error: 'invalid' });
  });

  it('has a distinct result for unknown hosts', () => {
    const url = 'electron-fiddle://workspace/abc';
    expect(parseDeepLink(url)).toEqual({ ok: false, url, error: 'unknown-host', host: 'workspace' });
    expect(parseDeepLink('Electron-Fiddle://NEW')).toMatchObject({ error: 'unknown-host', host: 'new' });
  });
});

describe('versionFromTag', () => {
  it('takes an optional v and a strict semver version', () => {
    expect(versionFromTag('v30.0.0')).toBe('30.0.0');
    expect(versionFromTag('30.0.0-alpha.1')).toBe('30.0.0-alpha.1');
    expect(versionFromTag('vv30.0.0')).toBeNull();
    expect(versionFromTag('30.0')).toBeNull();
    expect(versionFromTag('main')).toBeNull();
  });
});

describe('argv', () => {
  it('finds the deep link in argv', () => {
    const link = `electron-fiddle://gist/${ID}`;
    expect(findDeepLinkInArgv(['/opt/electron-fiddle', '--no-sandbox', link, 'other'])).toBe(link);
    expect(findDeepLinkInArgv(['app', 'ELECTRON-FIDDLE://gist/x'])).toBe('ELECTRON-FIDDLE://gist/x');
    expect(findDeepLinkInArgv(['app', '/some/folder'])).toBeUndefined();
  });

  it('treats any electron-fiddle: argument as a link', () => {
    expect(isDeepLink('electron-fiddle:anything')).toBe(true);
    expect(isDeepLink('/path/electron-fiddle://x')).toBe(false);
  });
});
