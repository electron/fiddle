import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { FiddleOrigin } from '../../fiddle/trust';
import { initMainI18n } from '../i18n';
import { ensureTrusted, type TrustPrompt } from './trust';

beforeAll(async () => {
  await initMainI18n(['en']);
});

const gist: FiddleOrigin = { kind: 'gist', owner: 'octo', id: 'abc', sha: 'def' };
const docs: FiddleOrigin = { kind: 'electron', tag: 'v30.0.0', path: 'docs/fiddles/x' };
const files = { 'main.js': '' };

function prompt(
  interactive: boolean,
  answer = '',
): TrustPrompt & { ask: ReturnType<typeof vi.fn> } {
  return { interactive, ask: vi.fn(async () => answer) };
}

describe('ensureTrusted', () => {
  it('lets local fiddles and examples run without asking', async () => {
    for (const origin of [{ kind: 'local' }, { kind: 'example' }] as FiddleOrigin[]) {
      const p = prompt(false);
      await expect(
        ensureTrusted({ origin, files }, {}, false, p),
      ).resolves.toBeUndefined();
      expect(p.ask).not.toHaveBeenCalled();
    }
  });

  it('lets a remote fiddle run with --trust, without asking', async () => {
    const p = prompt(false);
    await expect(
      ensureTrusted({ origin: gist, files }, {}, true, p),
    ).resolves.toBeUndefined();
    expect(p.ask).not.toHaveBeenCalled();
  });

  it('fails closed without --trust and without a terminal', async () => {
    for (const origin of [gist, docs]) {
      const p = prompt(false);
      await expect(ensureTrusted({ origin, files }, {}, false, p)).rejects.toMatchObject({
        code: 'untrusted',
        message: expect.stringContaining('Add --trust'),
      });
      expect(p.ask).not.toHaveBeenCalled();
    }
  });

  it('asks at a terminal, showing the origin, files and dependencies', async () => {
    const yes = prompt(true, 'y');
    await ensureTrusted({ origin: gist, files }, { lodash: '^4' }, false, yes);
    const [detail, question] = yes.ask.mock.calls[0] as [string, string];
    expect(detail).toContain('gist:octo/abc@def');
    expect(detail).toContain('main.js');
    expect(detail).toContain('lodash@^4');
    expect(question).toBe('Continue? [y/N] ');

    await expect(
      ensureTrusted({ origin: gist, files }, {}, false, prompt(true, 'YES ')),
    ).resolves.toBeUndefined();
    for (const answer of ['', 'n', 'no', 'sure']) {
      await expect(
        ensureTrusted({ origin: gist, files }, {}, false, prompt(true, answer)),
      ).rejects.toMatchObject({
        code: 'untrusted',
      });
    }
  });
});
