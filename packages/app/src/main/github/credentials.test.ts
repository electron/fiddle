import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CredentialStore, type SafeStorageLike } from './credentials';

const CREDS = { token: `ghp_${'a'.repeat(36)}`, login: 'octocat' };

/** A reversible fake: "enc:" + base64. Decrypting anything else throws, like a wrong key. */
function fakeSafeStorage(overrides: Partial<SafeStorageLike> & { backend?: string } = {}): SafeStorageLike {
  return {
    isAsyncEncryptionAvailable: async () => true,
    encryptStringAsync: async (text) => Buffer.from(`enc:${Buffer.from(text).toString('base64')}`),
    decryptStringAsync: async (data) => {
      const text = data.toString();
      if (!text.startsWith('enc:')) throw new Error('Error while decrypting the ciphertext');
      return { result: Buffer.from(text.slice(4), 'base64').toString(), shouldReEncrypt: false };
    },
    getSelectedStorageBackend: () => overrides.backend ?? 'gnome_libsecret',
    ...overrides,
  };
}

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'gh-creds-'));
  file = path.join(dir, 'credentials', 'github');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const open = (safeStorage = fakeSafeStorage(), platform: NodeJS.Platform = 'darwin') =>
  new CredentialStore({ file, safeStorage, platform });

describe('CredentialStore', () => {
  it('reports no credentials when there is no file', async () => {
    expect(await open().load()).toEqual({ kind: 'none' });
  });

  // @feature gist.token-encrypted
  it('round-trips encrypted credentials, never as plain text on disk', async () => {
    const store = open();
    expect(await store.save(CREDS, { allowPlaintext: false })).toBe(true);
    expect(await store.load()).toEqual({ kind: 'ok', credentials: CREDS });
    expect((await readFile(file)).toString()).not.toContain(CREDS.token);
  });

  // @feature gist.token-encrypted
  it.skipIf(process.platform === 'win32')('writes the file with mode 0600 in a 0700 folder', async () => {
    await open().save(CREDS, { allowPlaintext: false });
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect((await stat(path.dirname(file))).mode & 0o777).toBe(0o700);
  });

  it('keeps the token for the session only on Linux with a basic_text or unknown backend', async () => {
    for (const backend of ['basic_text', 'unknown']) {
      const store = open(fakeSafeStorage({ backend }), 'linux');
      expect(await store.kind()).toBe('weak');
      expect(await store.save(CREDS, { allowPlaintext: false })).toBe(false);
      expect(await store.load()).toEqual({ kind: 'none' });
    }
  });

  it('stores on a weak Linux backend once plaintext storage is accepted', async () => {
    const store = open(fakeSafeStorage({ backend: 'basic_text' }), 'linux');
    expect(await store.save(CREDS, { allowPlaintext: true })).toBe(true);
    expect(await store.load()).toEqual({ kind: 'ok', credentials: CREDS });
  });

  it('treats basic_text as weak only on Linux', async () => {
    expect(await open(fakeSafeStorage({ backend: 'basic_text' }), 'darwin').kind()).toBe('encrypted');
  });

  // @feature gist.token-encrypted
  it('never persists when encryption is unavailable, and removes an older file', async () => {
    await open().save(CREDS, { allowPlaintext: false });
    const store = open(fakeSafeStorage({ isAsyncEncryptionAvailable: async () => false }));
    expect(await store.kind()).toBe('unavailable');
    expect(await store.save(CREDS, { allowPlaintext: true })).toBe(false);
    expect(await open().load()).toEqual({ kind: 'none' });
  });

  it('reports a file it cannot decrypt, and keeps it', async () => {
    await open().save(CREDS, { allowPlaintext: false });
    const before = await readFile(file);
    const broken = fakeSafeStorage({
      decryptStringAsync: async () => {
        throw new Error('Error while decrypting the ciphertext');
      },
    });
    expect(await open(broken).load()).toEqual({ kind: 'decrypt-failed' });
    expect(await readFile(file)).toEqual(before);
  });

  it('reports a file with an unexpected payload as undecryptable', async () => {
    await open().save(CREDS, { allowPlaintext: false });
    await writeFile(file, `enc:${Buffer.from('not json').toString('base64')}`);
    expect(await open().load()).toEqual({ kind: 'decrypt-failed' });
  });

  it('re-encrypts when safeStorage asks for it', async () => {
    await open().save(CREDS, { allowPlaintext: false });
    let encrypts = 0;
    const base = fakeSafeStorage();
    const rotating = fakeSafeStorage({
      decryptStringAsync: async (data) => ({ ...(await base.decryptStringAsync(data)), shouldReEncrypt: true }),
      encryptStringAsync: async (text) => {
        encrypts++;
        return base.encryptStringAsync(text);
      },
    });
    expect(await open(rotating).load()).toEqual({ kind: 'ok', credentials: CREDS });
    expect(encrypts).toBe(1);
  });

  // @feature gist.sign-out
  it('deletes the file on sign-out', async () => {
    const store = open();
    await store.save(CREDS, { allowPlaintext: false });
    await store.delete();
    expect(await store.load()).toEqual({ kind: 'none' });
    await store.delete(); // No file is fine.
  });
});
