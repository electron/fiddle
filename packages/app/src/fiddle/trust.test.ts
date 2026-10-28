import { describe, expect, it } from 'vitest';

import {
  ANONYMOUS_GIST_OWNER,
  type FiddleOrigin,
  formatOrigin,
  gistOrigin,
  isUntrustedOrigin,
  needsApproval,
  restoredOrigin,
} from './trust';

const id = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';
const sha = 'a'.repeat(40);

const origins: [FiddleOrigin, string][] = [
  [{ kind: 'local' }, 'local'],
  [{ kind: 'example' }, 'example'],
  [{ kind: 'gist', owner: 'octocat', id, sha }, `gist:octocat/${id}@${sha}`],
  [
    { kind: 'electron', tag: 'v30.0.0', path: 'docs/fiddles/quick-start' },
    'electron:v30.0.0/docs/fiddles/quick-start',
  ],
];

describe('origins', () => {
  it.each(origins)('formats %j', (origin, text) => {
    expect(formatOrigin(origin)).toBe(text);
  });

  it('marks remote origins untrusted', () => {
    expect(origins.map(([o]) => isUntrustedOrigin(o))).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });

  it('builds gist origins, with a placeholder owner for anonymous gists', () => {
    expect(gistOrigin(id.toUpperCase(), sha.toUpperCase(), 'octocat')).toEqual({
      kind: 'gist',
      owner: 'octocat',
      id,
      sha,
    });
    expect(formatOrigin(gistOrigin(id, sha, null))).toBe(
      `gist:${ANONYMOUS_GIST_OWNER}/${id}@${sha}`,
    );
  });
});

describe('needsApproval', () => {
  it('asks for remote fiddles until that exact origin is approved', () => {
    const gist = gistOrigin(id, sha, 'octocat');
    expect(needsApproval(gist)).toBe(true);
    expect(needsApproval(gist, formatOrigin(gist))).toBe(false);
    // Another revision of the same gist needs approval again.
    expect(
      needsApproval(gistOrigin(id, 'b'.repeat(40), 'octocat'), formatOrigin(gist)),
    ).toBe(true);
    const docs: FiddleOrigin = {
      kind: 'electron',
      tag: 'v30.0.0',
      path: 'docs/fiddles/x',
    };
    expect(needsApproval(docs, formatOrigin(gist))).toBe(true);
    expect(needsApproval(docs, formatOrigin(docs))).toBe(false);
  });

  it('binds an approval to its origin: a fiddle swapped in afterwards needs its own', () => {
    const approved = formatOrigin(gistOrigin(id, sha, 'octocat'));
    const swapped = gistOrigin('0'.repeat(32), sha, 'mallory');
    expect(needsApproval(swapped, approved)).toBe(true);
  });

  it('never asks for local fiddles and examples', () => {
    expect(needsApproval({ kind: 'local' })).toBe(false);
    expect(needsApproval({ kind: 'example' }, 'something-else')).toBe(false);
  });
});

describe('restoredOrigin', () => {
  const gist = gistOrigin(id, sha, 'octocat');

  it('keeps a saved untrusted origin when the folder load reports local', () => {
    expect(restoredOrigin({ kind: 'local' }, gist)).toBe(gist);
    expect(restoredOrigin({ kind: 'local' }, undefined, gist)).toBe(gist);
    expect(needsApproval(restoredOrigin({ kind: 'local' }, gist))).toBe(true);
  });

  it('keeps the loaded origin when nothing untrusted is remembered', () => {
    expect(restoredOrigin({ kind: 'local' })).toEqual({ kind: 'local' });
    expect(restoredOrigin({ kind: 'local' }, undefined, { kind: 'example' })).toEqual({
      kind: 'local',
    });
  });
});
