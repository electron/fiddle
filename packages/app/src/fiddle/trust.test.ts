import { describe, expect, it } from 'vitest';

import { ANONYMOUS_GIST_OWNER, type FiddleOrigin, formatOrigin, gistOrigin, isUntrustedOrigin, needsApproval } from './trust';

const id = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';
const sha = 'a'.repeat(40);

const origins: [FiddleOrigin, string][] = [
  [{ kind: 'local' }, 'local'],
  [{ kind: 'example' }, 'example'],
  [{ kind: 'gist', owner: 'octocat', id, sha }, `gist:octocat/${id}@${sha}`],
  [{ kind: 'electron', tag: 'v30.0.0', path: 'docs/fiddles/quick-start' }, 'electron:v30.0.0/docs/fiddles/quick-start'],
];

describe('origins', () => {
  it.each(origins)('formats %j', (origin, text) => {
    expect(formatOrigin(origin)).toBe(text);
  });

  it('marks remote origins untrusted', () => {
    expect(origins.map(([o]) => isUntrustedOrigin(o))).toEqual([false, false, true, true]);
  });

  it('builds gist origins, with a placeholder owner for anonymous gists', () => {
    expect(gistOrigin(id.toUpperCase(), sha.toUpperCase(), 'octocat')).toEqual({ kind: 'gist', owner: 'octocat', id, sha });
    expect(formatOrigin(gistOrigin(id, sha, null))).toBe(`gist:${ANONYMOUS_GIST_OWNER}/${id}@${sha}`);
  });
});

describe('needsApproval', () => {
  it('asks for remote fiddles until that exact origin is approved', () => {
    const gist = gistOrigin(id, sha, 'octocat');
    expect(needsApproval(gist)).toBe(true);
    expect(needsApproval(gist, formatOrigin(gist))).toBe(false);
    // Another revision of the same gist needs approval again.
    expect(needsApproval(gistOrigin(id, 'b'.repeat(40), 'octocat'), formatOrigin(gist))).toBe(true);
    const docs: FiddleOrigin = { kind: 'electron', tag: 'v30.0.0', path: 'docs/fiddles/x' };
    expect(needsApproval(docs, formatOrigin(gist))).toBe(true);
    expect(needsApproval(docs, formatOrigin(docs))).toBe(false);
  });

  it('never asks for local fiddles and examples', () => {
    expect(needsApproval({ kind: 'local' })).toBe(false);
    expect(needsApproval({ kind: 'example' }, 'something-else')).toBe(false);
  });
});
