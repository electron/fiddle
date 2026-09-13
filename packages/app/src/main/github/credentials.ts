/**
 * The GitHub token on disk (REQUIREMENTS §4 "Credentials and GitHub"):
 * `<userData>/credentials/github`, encrypted with async `safeStorage`.
 *
 * - On Linux with a `basic_text` or `unknown` backend, encryption is only
 *   obfuscation, so the token is kept for the session unless the user
 *   explicitly accepts plaintext storage.
 * - Without any encryption, the token is always session-only.
 * - A file that can't be decrypted is reported and kept, never deleted.
 *
 * No Electron imports: `safeStorage` is injected, so this runs in plain Node tests.
 */
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import { writeAtomic } from '../persistence/json-store';

/** The subset of Electron's `safeStorage` this module uses. */
export interface SafeStorageLike {
  isAsyncEncryptionAvailable(): Promise<boolean>;
  encryptStringAsync(plainText: string): Promise<Buffer>;
  decryptStringAsync(encrypted: Buffer): Promise<{ result: string; shouldReEncrypt: boolean }>;
  getSelectedStorageBackend(): string;
}

/** `encrypted`: stored safely. `weak`: Linux without a keyring. `unavailable`: no encryption at all. */
export type CredentialStorageKind = 'encrypted' | 'weak' | 'unavailable';

interface StoredCredentials {
  token: string;
  /** The login the token belonged to when it was saved, so an offline start still knows it. */
  login: string;
}

export type LoadResult =
  | { kind: 'none' }
  | { kind: 'ok'; credentials: StoredCredentials }
  | { kind: 'decrypt-failed' };

const WEAK_LINUX_BACKENDS = new Set(['basic_text', 'unknown']);

interface CredentialStoreOptions {
  /** Absolute path, normally `<userData>/credentials/github`. */
  file: string;
  safeStorage: SafeStorageLike;
  platform: NodeJS.Platform;
}

export class CredentialStore {
  readonly #file: string;
  readonly #safeStorage: SafeStorageLike;
  readonly #platform: NodeJS.Platform;

  constructor(options: CredentialStoreOptions) {
    this.#file = options.file;
    this.#safeStorage = options.safeStorage;
    this.#platform = options.platform;
  }

  async kind(): Promise<CredentialStorageKind> {
    if (!(await this.#safeStorage.isAsyncEncryptionAvailable())) return 'unavailable';
    if (this.#platform === 'linux' && WEAK_LINUX_BACKENDS.has(this.#safeStorage.getSelectedStorageBackend())) {
      return 'weak';
    }
    return 'encrypted';
  }

  async load(): Promise<LoadResult> {
    let data: Buffer;
    try {
      data = await readFile(this.#file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { kind: 'none' };
      throw error;
    }
    let credentials: StoredCredentials;
    let shouldReEncrypt: boolean;
    try {
      const decrypted = await this.#safeStorage.decryptStringAsync(data);
      shouldReEncrypt = decrypted.shouldReEncrypt;
      credentials = parseCredentials(decrypted.result);
    } catch {
      return { kind: 'decrypt-failed' };
    }
    if (shouldReEncrypt) {
      // Best effort: the key rotated. The old file still decrypts if this fails.
      await this.#write(credentials).catch(() => undefined);
    }
    return { kind: 'ok', credentials };
  }

  /**
   * Saves the credentials when storage allows it. Returns false when the token
   * must stay in memory for this session only; any older file is removed then.
   */
  async save(credentials: StoredCredentials, options: { allowPlaintext: boolean }): Promise<boolean> {
    const kind = await this.kind();
    if (kind === 'unavailable' || (kind === 'weak' && !options.allowPlaintext)) {
      await this.delete();
      return false;
    }
    await this.#write(credentials);
    return true;
  }

  async delete(): Promise<void> {
    await rm(this.#file, { force: true });
  }

  async #write(credentials: StoredCredentials): Promise<void> {
    const encrypted = await this.#safeStorage.encryptStringAsync(JSON.stringify(credentials));
    await mkdir(path.dirname(this.#file), { recursive: true, mode: 0o700 });
    await writeAtomic(this.#file, encrypted, { mode: 0o600 });
  }
}

function parseCredentials(text: string): StoredCredentials {
  const data: unknown = JSON.parse(text);
  if (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as StoredCredentials).token === 'string' &&
    typeof (data as StoredCredentials).login === 'string'
  ) {
    return { token: (data as StoredCredentials).token, login: (data as StoredCredentials).login };
  }
  throw new Error('Unexpected credentials format');
}
