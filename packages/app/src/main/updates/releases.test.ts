import { describe, expect, it } from 'vitest';

import { pickUpdate, type GitHubRelease } from './releases';

describe('pickUpdate', () => {
  const release = (tag: string, extra: Partial<GitHubRelease> = {}): GitHubRelease => ({
    tag_name: tag,
    html_url: `https://github.com/electron/fiddle/releases/tag/${tag}`,
    ...extra,
  });

  it('picks the newest release above the current version', () => {
    const releases = [
      release('v1.1.0'),
      release('v1.3.0'),
      release('v1.2.0'),
      release('v0.9.0'),
    ];
    expect(pickUpdate(releases, '1.0.0')).toEqual({
      version: '1.3.0',
      url: 'https://github.com/electron/fiddle/releases/tag/v1.3.0',
    });
    expect(pickUpdate(releases, '1.3.0')).toBeUndefined();
  });

  it('skips drafts and prereleases', () => {
    const releases = [
      release('v2.0.0', { draft: true }),
      release('v1.5.0-beta.1', { prerelease: true }),
      release('v1.4.0'),
    ];
    expect(pickUpdate(releases, '1.0.0')?.version).toBe('1.4.0');
  });

  it('only links to electron/fiddle release pages', () => {
    const releases = [
      release('v9.0.0', { html_url: 'https://evil.example.com/v9.0.0' }),
      release('not-a-version'),
    ];
    expect(pickUpdate(releases, '1.0.0')).toBeUndefined();
  });
});
