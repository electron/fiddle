import { describe, expect, it } from 'vitest';

import { FiddleError } from '../shared/errors';
import {
  CODE_EXECUTING_OPERATIONS,
  type FiddleOrigin,
  formatOrigin,
  isCodeExecutingOperation,
  isUntrustedOrigin,
  needsApproval,
  parseOrigin,
} from './trust';

const id = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';
const sha = 'a'.repeat(40);

const origins: [FiddleOrigin, string][] = [
  [{ kind: 'local' }, 'local'],
  [{ kind: 'example' }, 'example'],
  [{ kind: 'gist', owner: 'octocat', id, sha }, `gist:octocat/${id}@${sha}`],
  [{ kind: 'electron', tag: 'v30.0.0', path: 'docs/fiddles/quick-start' }, 'electron:v30.0.0/docs/fiddles/quick-start'],
];

describe('origins', () => {
  it.each(origins)('formats and parses %j', (origin, text) => {
    expect(formatOrigin(origin)).toBe(text);
    expect(parseOrigin(text)).toEqual(origin);
  });

  it.each(['', 'remote', 'gist:octocat/short@x', `gist:${id}@${sha}`, 'electron:v30.0.0'])('rejects %j', (text) => {
    expect(() => parseOrigin(text)).toThrow(FiddleError);
  });

  it('marks remote origins untrusted', () => {
    expect(origins.map(([o]) => isUntrustedOrigin(o))).toEqual([false, false, true, true]);
  });
});

describe('operations', () => {
  it('lists the code-executing operations', () => {
    expect([...CODE_EXECUTING_OPERATIONS]).toEqual(['run', 'install-modules', 'auto-bisect', 'package', 'make']);
    for (const op of CODE_EXECUTING_OPERATIONS) expect(isCodeExecutingOperation(op)).toBe(true);
    for (const op of ['save', 'publish', 'export', 'bisect-manual', 'load']) expect(isCodeExecutingOperation(op)).toBe(false);
  });

  it('asks for approval only for code on untrusted fiddles', () => {
    const gist: FiddleOrigin = { kind: 'gist', owner: 'o', id, sha };
    expect(needsApproval(gist, 'run', false)).toBe(true);
    expect(needsApproval(gist, 'package', false)).toBe(true);
    expect(needsApproval(gist, 'run', true)).toBe(false);
    expect(needsApproval(gist, 'save', false)).toBe(false);
    expect(needsApproval({ kind: 'local' }, 'run', false)).toBe(false);
    expect(needsApproval({ kind: 'example' }, 'make', false)).toBe(false);
  });
});
