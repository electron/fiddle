import { describe, expect, it } from 'vitest';

import { evaluatePolicy, parsePolicy, pickUpdate, type GitHubRelease } from './policy';

describe('parsePolicy', () => {
  it('accepts the documented shape and fills defaults', () => {
    expect(
      parsePolicy({
        blockedVersions: ['1.0.0'],
        minVersion: '0.9.0',
        message: 'Update now',
      }),
    ).toEqual({
      blockedVersions: ['1.0.0'],
      minVersion: '0.9.0',
      message: 'Update now',
    });
    expect(parsePolicy({})).toEqual({ blockedVersions: [] });
  });

  it('rejects anything else', () => {
    expect(parsePolicy(null)).toBeUndefined();
    expect(parsePolicy({ blockedVersions: '1.0.0' })).toBeUndefined();
    expect(parsePolicy({ message: 42 })).toBeUndefined();
  });
});

describe('evaluatePolicy', () => {
  const policy = (fields: object) => parsePolicy(fields)!;

  it('blocks listed versions, exact or as ranges', () => {
    expect(
      evaluatePolicy(policy({ blockedVersions: ['1.2.3'], message: 'Broken' }), '1.2.3'),
    ).toEqual({
      blocked: true,
      message: 'Broken',
    });
    expect(
      evaluatePolicy(policy({ blockedVersions: ['v1.2.3'] }), 'v1.2.3').blocked,
    ).toBe(true);
    expect(
      evaluatePolicy(policy({ blockedVersions: ['>=1.2.0 <1.3.0'] }), '1.2.9').blocked,
    ).toBe(true);
    expect(evaluatePolicy(policy({ blockedVersions: ['1.2.x'] }), '1.3.0').blocked).toBe(
      false,
    );
  });

  it('includes prereleases in ranges', () => {
    expect(
      evaluatePolicy(policy({ blockedVersions: ['1.0.x'] }), '1.0.1-beta.2').blocked,
    ).toBe(true);
  });

  it('blocks versions below minVersion', () => {
    expect(evaluatePolicy(policy({ minVersion: '1.0.0' }), '1.0.0-alpha.0').blocked).toBe(
      true,
    );
    expect(evaluatePolicy(policy({ minVersion: '1.0.0' }), '1.0.0').blocked).toBe(false);
  });

  it('ignores empty entries, which would otherwise block every version', () => {
    expect(evaluatePolicy(policy({ blockedVersions: ['', '  '] }), '1.0.0')).toEqual({
      blocked: false,
    });
    expect(
      evaluatePolicy(policy({ blockedVersions: ['', '1.0.0'] }), '1.0.0').blocked,
    ).toBe(true);
  });

  it('ignores invalid entries and invalid app versions', () => {
    expect(
      evaluatePolicy(policy({ blockedVersions: ['nonsense'], minVersion: 'x' }), '1.0.0'),
    ).toEqual({
      blocked: false,
    });
    expect(evaluatePolicy(policy({ blockedVersions: ['*'] }), 'dev')).toEqual({
      blocked: false,
    });
  });
});

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
