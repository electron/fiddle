/** The GitHub IPC handlers: clipboard tokens and gists, share links, history rows and the storage kind. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handlers: {} as Record<string, (...args: unknown[]) => unknown>,
  clipboardText: '',
  writeText: vi.fn<(text: string) => void>(),
  openExternalLink: vi.fn<(url: string, parent?: unknown) => Promise<void>>(),
}));

vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: () => null },
  clipboard: { readText: () => mocks.clipboardText, writeText: mocks.writeText },
}));
vi.mock('../../ipc/main', () => ({
  GitHub: {},
  implement: (_iface: unknown, _contents: unknown, handlers: typeof mocks.handlers) => {
    mocks.handlers = handlers;
  },
}));
vi.mock('../security', () => ({ openExternalLink: mocks.openExternalLink }));

import { GitHubCredentialStorage } from '../../ipc/generated/common/fiddle';
import { bindGitHubIpc } from './ipc';

const TOKEN = `ghp_${'a'.repeat(36)}`;
const GIST = '0123456789abcdef0123456789abcdef';

const github = {
  credentialStorage: vi.fn<() => Promise<'encrypted' | 'weak' | 'unavailable'>>(),
  signIn: vi.fn(async (_token: string, _allowPlaintext: boolean) => ({ ok: true })),
  takeNotice: vi.fn<() => { kind: string } | undefined>(),
  history: vi.fn(),
  publish: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clipboardText = '';
  bindGitHubIpc({ contents: {}, windowId: 'w', services: { github } } as never);
});

describe('SignInFromClipboard', () => {
  it('signs in with the token on the clipboard, trimmed', async () => {
    mocks.clipboardText = `  ${TOKEN}\n`;
    expect(await mocks.handlers.SignInFromClipboard!(true)).toEqual({ ok: true });
    expect(github.signIn).toHaveBeenCalledWith(TOKEN, true);
  });

  it('throws invalidArgument with reason bad-format when the clipboard holds no token', async () => {
    mocks.clipboardText = 'hunter2';
    await expect(mocks.handlers.SignInFromClipboard!(false)).rejects.toMatchObject({
      code: 'invalid-argument',
      details: { reason: 'bad-format' },
    });
    expect(github.signIn).not.toHaveBeenCalled();
  });
});

it('HasClipboardToken says whether the clipboard text is a token, ignoring surrounding space', async () => {
  mocks.clipboardText = `\t${TOKEN} `;
  expect(await mocks.handlers.HasClipboardToken!()).toBe(true);
  mocks.clipboardText = `token: ${TOKEN}`;
  expect(await mocks.handlers.HasClipboardToken!()).toBe(false);
});

it('ReadClipboardGist hands the renderer a gist reference and nothing else', async () => {
  mocks.clipboardText = ` https://gist.github.com/someone/${GIST.toUpperCase()} `;
  expect(await mocks.handlers.ReadClipboardGist!()).toBe(
    `https://gist.github.com/someone/${GIST}`,
  );
  mocks.clipboardText = TOKEN;
  expect(await mocks.handlers.ReadClipboardGist!()).toBeNull();
});

describe('CopyShareLink', () => {
  it("puts the gist's URL on the clipboard", () => {
    mocks.handlers.CopyShareLink!(GIST);
    expect(mocks.writeText).toHaveBeenCalledWith(`https://gist.github.com/${GIST}`);
  });

  it('rejects anything but a bare gist ID, writing nothing', () => {
    expect(() =>
      mocks.handlers.CopyShareLink!(`https://gist.github.com/${GIST}`),
    ).toThrow(expect.objectContaining({ code: 'invalid-argument' }));
    expect(mocks.writeText).not.toHaveBeenCalled();
  });
});

it("publishes, updates and deletes its own window's gist", () => {
  mocks.handlers.Publish!('My fiddle', true);
  mocks.handlers.Update!();
  mocks.handlers.Delete!();
  expect(github.publish).toHaveBeenCalledWith('w', {
    description: 'My fiddle',
    isPublic: true,
  });
  expect(github.update).toHaveBeenCalledWith('w');
  expect(github.delete).toHaveBeenCalledWith('w');
});

it('GetHistory numbers the revisions, with 0 for the one that created the gist', async () => {
  github.history.mockResolvedValue({
    id: GIST,
    activeSha: 'b',
    revisions: [
      { sha: 'a', date: '2026-01-01', additions: 3, deletions: 0, total: 3 },
      { sha: 'b', date: '2026-01-02', additions: 1, deletions: 2, total: 3 },
    ],
  });
  expect(await mocks.handlers.GetHistory!()).toEqual({
    id: GIST,
    activeSha: 'b',
    revisions: [
      { sha: 'a', date: '2026-01-01', additions: 3, deletions: 0, n: 0 },
      { sha: 'b', date: '2026-01-02', additions: 1, deletions: 2, n: 1 },
    ],
  });
  expect(github.history).toHaveBeenCalledWith('w');
});

it.each([
  ['encrypted', GitHubCredentialStorage.Encrypted],
  ['weak', GitHubCredentialStorage.Weak],
  ['unavailable', GitHubCredentialStorage.Unavailable],
] as const)(
  'GetCredentialStorage reports %s storage as its enum value',
  async (kind, value) => {
    github.credentialStorage.mockResolvedValue(kind);
    expect(await mocks.handlers.GetCredentialStorage!()).toBe(value);
  },
);

it('TakeNotice turns no notice into null for the wire', () => {
  github.takeNotice.mockReturnValue(undefined);
  expect(mocks.handlers.TakeNotice!()).toBeNull();
  github.takeNotice.mockReturnValue({ kind: 'signed-out' });
  expect(mocks.handlers.TakeNotice!()).toEqual({ kind: 'signed-out' });
});

it('OpenNewTokenPage opens the new-token page with the gist scope prefilled', async () => {
  await mocks.handlers.OpenNewTokenPage!();
  expect(mocks.openExternalLink).toHaveBeenCalledWith(
    expect.stringMatching(/^https:\/\/github\.com\/settings\/tokens\/new\?scopes=gist&/),
    undefined,
  );
});
