import * as fs from 'node:fs';
import * as path from 'node:path';

import { IpcMainInvokeEvent, safeStorage } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  areValidGistFiles,
  deleteToken,
  handleGistCreate,
  handleGistDelete,
  handleGistListCommits,
  handleGistLoad,
  handleGistUpdate,
  handleTokenCheckAuth,
  handleTokenSignIn,
  handleTokenSignOut,
  isValidDescription,
  isValidGistId,
  isValidSha,
  isValidToken,
  loadToken,
  saveToken,
} from '../../src/main/github';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => Buffer.from('')),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));
vi.mock('@octokit/rest', () => {
  const MockOctokit = vi.fn();
  return { Octokit: MockOctokit };
});

const mockEvent = {} as IpcMainInvokeEvent;

// Import Octokit so we can mock its constructor
const { Octokit } = await import('@octokit/rest');

function mockOctokitInstance(overrides: Record<string, any> = {}) {
  const instance = {
    users: {
      getAuthenticated: vi.fn().mockResolvedValue({
        headers: { 'x-oauth-scopes': 'gist' },
        data: { login: MOCK_LOGIN },
      }),
    },
    gists: {
      create: vi.fn().mockResolvedValue({
        data: { ...MOCK_GIST_DATA },
      }),
      update: vi.fn().mockResolvedValue({
        data: { ...MOCK_GIST_DATA, history: [{ version: 'sha2' }], files: {} },
      }),
      delete: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue({
        data: { ...MOCK_GIST_DATA },
      }),
      getRevision: vi.fn().mockResolvedValue({
        data: { ...MOCK_GIST_DATA },
      }),
      listCommits: vi.fn().mockResolvedValue({
        data: [
          {
            version: 'sha2',
            committed_at: '2025-01-02',
            change_status: { total: 5, additions: 3, deletions: 2 },
          },
          {
            version: 'sha1',
            committed_at: '2025-01-01',
            change_status: { total: 10, additions: 10, deletions: 0 },
          },
        ],
      }),
    },
    ...overrides,
  };

  vi.mocked(Octokit).mockImplementation(function () {
    return instance as any;
  });
  return instance;
}

const VALID_GHP_TOKEN = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh12';
const VALID_PAT_TOKEN =
  'github_pat_ABCDEFGHIJKLMNOPQRSTUV_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzABCDEFG';
const VALID_GIST_ID = 'abc123def456abc123def456abc123de';
const VALID_SHA = 'abc123def456abc123def456abc123deabc123de';
const MOCK_LOGIN = 'testuser';
const CREDENTIALS_FILE = '.github-credentials';
const VALID_FILES = {
  'main.js': { filename: 'main.js', content: 'code' },
};

const MOCK_GIST_FILES = {
  'main.js': {
    filename: 'main.js',
    content: 'console.log("hi")',
    truncated: false,
    raw_url: 'https://raw.example.com/main.js',
  },
};

const MOCK_GIST_DATA = {
  id: VALID_GIST_ID,
  html_url: `https://gist.github.com/${VALID_GIST_ID}`,
  history: [{ version: 'sha1' }],
  files: MOCK_GIST_FILES,
};

// Re-establish safeStorage mock implementations after global vi.resetAllMocks()
function restoreSafeStorageMocks() {
  vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
  vi.mocked(safeStorage.encryptString).mockImplementation((text: string) =>
    Buffer.from(`encrypted:${text}`),
  );
  vi.mocked(safeStorage.decryptString).mockImplementation((buffer: Buffer) => {
    const str = buffer.toString();
    return str.startsWith('encrypted:') ? str.slice('encrypted:'.length) : str;
  });
}

describe('github', () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    restoreSafeStorageMocks();
    // Reset module-level octokit state by signing out
    handleTokenSignOut(mockEvent);
  });

  // --- Input validation ---

  describe('isValidToken()', () => {
    it('accepts a valid ghp_ token', () => {
      expect(isValidToken(VALID_GHP_TOKEN)).toBe(true);
    });

    it('accepts a valid github_pat_ token', () => {
      expect(isValidToken(VALID_PAT_TOKEN)).toBe(true);
    });

    it('rejects non-string input', () => {
      expect(isValidToken(null)).toBe(false);
      expect(isValidToken(undefined)).toBe(false);
      expect(isValidToken(123)).toBe(false);
      expect(isValidToken({})).toBe(false);
      expect(isValidToken([])).toBe(false);
    });

    it('rejects invalid token strings', () => {
      expect(isValidToken('')).toBe(false);
      expect(isValidToken('gho_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh12')).toBe(
        false,
      );
      expect(isValidToken('ghp_tooshort')).toBe(false);
      expect(isValidToken('ghp_' + 'a'.repeat(100))).toBe(false);
      expect(isValidToken(` ${VALID_GHP_TOKEN}`)).toBe(false);
      expect(isValidToken(`${VALID_GHP_TOKEN} `)).toBe(false);
    });
  });

  describe('isValidGistId()', () => {
    it('accepts a valid 32-char hex gist ID', () => {
      expect(isValidGistId(VALID_GIST_ID)).toBe(true);
      expect(isValidGistId('AABBCCDDEE11223344556677889900FF')).toBe(true);
    });

    it('rejects non-string input', () => {
      expect(isValidGistId(null)).toBe(false);
      expect(isValidGistId(undefined)).toBe(false);
      expect(isValidGistId(123)).toBe(false);
    });

    it('rejects invalid gist ID strings', () => {
      expect(isValidGistId('abc123')).toBe(false);
      expect(isValidGistId('a'.repeat(33))).toBe(false);
      expect(isValidGistId('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')).toBe(false);
      expect(
        isValidGistId(
          'https://gist.github.com/abc123def456abc123def456abc123de',
        ),
      ).toBe(false);
    });
  });

  describe('isValidSha()', () => {
    it('accepts a valid 40-char hex SHA', () => {
      expect(isValidSha(VALID_SHA)).toBe(true);
    });

    it('rejects non-string input', () => {
      expect(isValidSha(null)).toBe(false);
      expect(isValidSha(undefined)).toBe(false);
    });

    it('rejects invalid SHA strings', () => {
      expect(isValidSha('abc123')).toBe(false);
      expect(isValidSha('a'.repeat(41))).toBe(false);
      expect(isValidSha('A'.repeat(40))).toBe(false);
    });
  });

  describe('isValidDescription()', () => {
    it('accepts a normal description', () => {
      expect(isValidDescription('My Fiddle')).toBe(true);
    });

    it('rejects empty string', () => {
      expect(isValidDescription('')).toBe(false);
    });

    it('rejects non-string input', () => {
      expect(isValidDescription(null)).toBe(false);
      expect(isValidDescription(123)).toBe(false);
    });

    it('rejects descriptions over 256 characters', () => {
      expect(isValidDescription('a'.repeat(257))).toBe(false);
    });

    it('accepts descriptions at the 256 character limit', () => {
      expect(isValidDescription('a'.repeat(256))).toBe(true);
    });
  });

  describe('areValidGistFiles()', () => {
    it('accepts valid gist files', () => {
      expect(
        areValidGistFiles({
          'main.js': { filename: 'main.js', content: 'code' },
        }),
      ).toBe(true);
    });

    it('accepts files with null values (for deletion)', () => {
      expect(
        areValidGistFiles({
          'main.js': { filename: 'main.js', content: 'code' },
          'old.js': null,
        }),
      ).toBe(true);
    });

    it('rejects non-object input', () => {
      expect(areValidGistFiles(null)).toBe(false);
      expect(areValidGistFiles('string')).toBe(false);
      expect(areValidGistFiles([])).toBe(false);
      expect(areValidGistFiles(123)).toBe(false);
    });

    it('rejects empty files object', () => {
      expect(areValidGistFiles({})).toBe(false);
    });

    it('rejects files where filename does not match key', () => {
      expect(
        areValidGistFiles({
          'main.js': { filename: 'sneaky.js', content: 'code' },
        }),
      ).toBe(false);
    });

    it('rejects files with empty filename', () => {
      expect(
        areValidGistFiles({
          '': { filename: '', content: 'code' },
        }),
      ).toBe(false);
    });

    it('rejects files with non-string content', () => {
      expect(
        areValidGistFiles({
          'main.js': { filename: 'main.js', content: 123 },
        }),
      ).toBe(false);
    });

    it('rejects files exceeding max file size', () => {
      const hugeContent = 'x'.repeat(10 * 1024 * 1024 + 1);
      expect(
        areValidGistFiles({
          'main.js': { filename: 'main.js', content: hugeContent },
        }),
      ).toBe(false);
    });

    it('rejects more than 300 files', () => {
      const files: Record<string, any> = {};
      for (let i = 0; i < 301; i++) {
        const name = `file${i}.js`;
        files[name] = { filename: name, content: 'x' };
      }
      expect(areValidGistFiles(files)).toBe(false);
    });
  });

  // --- Token storage ---

  describe('saveToken() / loadToken() / deleteToken()', () => {
    it('saves an encrypted token to disk', () => {
      saveToken('test-token');
      expect(safeStorage.encryptString).toHaveBeenCalledWith('test-token');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining(CREDENTIALS_FILE),
        expect.any(Buffer),
      );
    });

    it('loads and decrypts a token from disk', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        Buffer.from('encrypted:my-token'),
      );

      const token = loadToken();
      expect(token).toBe('my-token');
    });

    it('returns null when no credentials file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(loadToken()).toBe(null);
    });

    it('returns null when decryption fails', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('corrupt');
      });
      expect(loadToken()).toBe(null);
    });

    it('deletes the credentials file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      deleteToken();
      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining(CREDENTIALS_FILE),
      );
    });

    it('does nothing when deleting a nonexistent file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      deleteToken();
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('stores credentials in userData directory', () => {
      saveToken('test');
      const writePath = vi.mocked(fs.writeFileSync).mock.calls[0][0] as string;
      expect(writePath).toBe(path.join('/Users/fake-user', CREDENTIALS_FILE));
    });
  });

  // --- Token sign-in ---

  describe('handleTokenSignIn()', () => {
    it('signs in with a valid token', async () => {
      mockOctokitInstance();
      const result = await handleTokenSignIn(mockEvent, VALID_GHP_TOKEN);
      expect(result).toEqual({ success: true, login: MOCK_LOGIN });
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('rejects an invalid token format', async () => {
      const expected = { success: false, error: 'Invalid token format.' };
      expect(await handleTokenSignIn(mockEvent, 'bad-token')).toEqual(expected);
      expect(await handleTokenSignIn(mockEvent, 12345)).toEqual(expected);
      expect(await handleTokenSignIn(mockEvent, null)).toEqual(expected);
    });

    it('rejects when encryption is unavailable', async () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);
      const result = await handleTokenSignIn(mockEvent, VALID_GHP_TOKEN);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Encryption is not available');
    });

    it('rejects a token missing the gist scope', async () => {
      mockOctokitInstance({
        users: {
          getAuthenticated: vi.fn().mockResolvedValue({
            headers: { 'x-oauth-scopes': 'repo' },
            data: { login: MOCK_LOGIN },
          }),
        },
      });

      const result = await handleTokenSignIn(mockEvent, VALID_GHP_TOKEN);
      expect(result.success).toBe(false);
      expect(result.error).toContain('gist');
    });

    it('handles GitHub API errors gracefully', async () => {
      mockOctokitInstance({
        users: {
          getAuthenticated: vi
            .fn()
            .mockRejectedValue(new Error('Bad credentials')),
        },
      });

      const result = await handleTokenSignIn(mockEvent, VALID_GHP_TOKEN);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid GitHub token');
    });
  });

  // --- Token sign-out ---

  describe('handleTokenSignOut()', () => {
    it('deletes the stored token', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const result = await handleTokenSignOut(mockEvent);
      expect(result).toEqual({ success: true });
      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  // --- Check auth ---

  describe('handleTokenCheckAuth()', () => {
    it('returns login when a valid token is stored', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        Buffer.from(`encrypted:${VALID_GHP_TOKEN}`),
      );
      mockOctokitInstance();

      const result = await handleTokenCheckAuth(mockEvent);
      expect(result).toEqual({ login: MOCK_LOGIN });
    });

    it('returns null when no token is stored', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = await handleTokenCheckAuth(mockEvent);
      expect(result).toEqual({ login: null });
    });

    it('cleans up and returns null for expired tokens', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        Buffer.from(`encrypted:${VALID_GHP_TOKEN}`),
      );
      mockOctokitInstance({
        users: {
          getAuthenticated: vi
            .fn()
            .mockRejectedValue(new Error('Bad credentials')),
        },
      });

      const result = await handleTokenCheckAuth(mockEvent);
      expect(result).toEqual({ login: null });
      // Should have deleted the invalid token
      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  // Helper to sign in and set up a fresh Octokit mock for gist tests
  async function signInForGistTests() {
    mockOctokitInstance();
    await handleTokenSignIn(mockEvent, VALID_GHP_TOKEN);
    // Clear call counts from sign-in so they don't leak into assertions
    vi.mocked(Octokit).mockClear();
    vi.mocked(fs.writeFileSync).mockClear();
  }

  // --- Gist create ---

  describe('handleGistCreate()', () => {
    beforeEach(async () => {
      await signInForGistTests();
    });

    it('creates a gist with valid parameters', async () => {
      const result = await handleGistCreate(mockEvent, {
        description: 'Test fiddle',
        files: VALID_FILES,
        isPublic: false,
      });

      expect(result.id).toBe(VALID_GIST_ID);
      expect(result.url).toContain('gist.github.com');
    });

    it('rejects invalid parameters object', async () => {
      await expect(handleGistCreate(mockEvent, null)).rejects.toThrow(
        'Invalid parameters',
      );
      await expect(handleGistCreate(mockEvent, 'string')).rejects.toThrow(
        'Invalid parameters',
      );
    });

    it('rejects invalid description', async () => {
      await expect(
        handleGistCreate(mockEvent, {
          description: '',
          files: VALID_FILES,
          isPublic: false,
        }),
      ).rejects.toThrow('Invalid description');
      await expect(
        handleGistCreate(mockEvent, {
          description: 'a'.repeat(257),
          files: VALID_FILES,
          isPublic: false,
        }),
      ).rejects.toThrow('Invalid description');
    });

    it('rejects invalid files', async () => {
      await expect(
        handleGistCreate(mockEvent, {
          description: 'Test',
          files: {},
          isPublic: false,
        }),
      ).rejects.toThrow('Invalid files');
    });

    it('rejects non-boolean isPublic', async () => {
      await expect(
        handleGistCreate(mockEvent, {
          description: 'Test',
          files: VALID_FILES,
          isPublic: 'yes',
        }),
      ).rejects.toThrow('isPublic must be a boolean');
    });

    it('throws when not authenticated', async () => {
      await handleTokenSignOut(mockEvent);
      await expect(
        handleGistCreate(mockEvent, {
          description: 'Test',
          files: VALID_FILES,
          isPublic: false,
        }),
      ).rejects.toThrow('Not authenticated');
    });
  });

  // --- Gist update ---

  describe('handleGistUpdate()', () => {
    beforeEach(async () => {
      await signInForGistTests();
    });

    it('updates a gist with valid parameters', async () => {
      const result = await handleGistUpdate(mockEvent, {
        gistId: VALID_GIST_ID,
        files: { 'main.js': { filename: 'main.js', content: 'new code' } },
      });

      expect(result.id).toBe(VALID_GIST_ID);
    });

    it('rejects invalid gist ID', async () => {
      await expect(
        handleGistUpdate(mockEvent, {
          gistId: 'not-valid',
          files: VALID_FILES,
        }),
      ).rejects.toThrow('Invalid gist ID');
    });

    it('rejects invalid files', async () => {
      await expect(
        handleGistUpdate(mockEvent, {
          gistId: VALID_GIST_ID,
          files: 'not-an-object',
        }),
      ).rejects.toThrow('Invalid files');
    });

    it('rejects invalid parameters object', async () => {
      await expect(handleGistUpdate(mockEvent, null)).rejects.toThrow(
        'Invalid parameters',
      );
    });
  });

  // --- Gist delete ---

  describe('handleGistDelete()', () => {
    beforeEach(async () => {
      await signInForGistTests();
    });

    it('deletes a gist with valid ID', async () => {
      const result = await handleGistDelete(mockEvent, VALID_GIST_ID);
      expect(result).toEqual({ success: true });
    });

    it('rejects invalid gist ID', async () => {
      await expect(handleGistDelete(mockEvent, 'bad-id')).rejects.toThrow(
        'Invalid gist ID',
      );
      await expect(handleGistDelete(mockEvent, 123)).rejects.toThrow(
        'Invalid gist ID',
      );
      await expect(handleGistDelete(mockEvent, null)).rejects.toThrow(
        'Invalid gist ID',
      );
    });
  });

  // --- Gist load ---

  describe('handleGistLoad()', () => {
    beforeEach(async () => {
      // Sign in so getOctokit() returns the authenticated instance
      await signInForGistTests();
    });

    it('loads a gist by ID', async () => {
      const result = await handleGistLoad(mockEvent, {
        gistId: VALID_GIST_ID,
      });

      expect(result.id).toBe(VALID_GIST_ID);
      expect(result.files['main.js'].content).toBe('console.log("hi")');
    });

    it('loads a gist at a specific revision', async () => {
      const result = await handleGistLoad(mockEvent, {
        gistId: VALID_GIST_ID,
        revision: VALID_SHA,
      });

      expect(result.id).toBe(VALID_GIST_ID);
    });

    it('rejects invalid gist ID', async () => {
      await expect(
        handleGistLoad(mockEvent, { gistId: 'bad' }),
      ).rejects.toThrow('Invalid gist ID');
    });

    it('rejects invalid revision SHA', async () => {
      await expect(
        handleGistLoad(mockEvent, {
          gistId: VALID_GIST_ID,
          revision: 'not-a-sha',
        }),
      ).rejects.toThrow('Invalid revision SHA');
    });

    it('rejects invalid parameters object', async () => {
      await expect(handleGistLoad(mockEvent, null)).rejects.toThrow(
        'Invalid parameters',
      );
    });

    it('works without authentication (public gists)', async () => {
      // Sign out, then set up a fresh mock so new Octokit() works
      await handleTokenSignOut(mockEvent);
      mockOctokitInstance();

      const result = await handleGistLoad(mockEvent, {
        gistId: VALID_GIST_ID,
      });
      expect(result.id).toBe(VALID_GIST_ID);
    });

    it('fetches full content for truncated files', async () => {
      const fullContent = 'a'.repeat(2000);

      // Sign out and re-sign-in with a mock that returns a truncated file
      await handleTokenSignOut(mockEvent);
      mockOctokitInstance({
        gists: {
          get: vi.fn().mockResolvedValue({
            data: {
              id: VALID_GIST_ID,
              history: [{ version: 'sha1' }],
              files: {
                'large.js': {
                  filename: 'large.js',
                  content: 'a'.repeat(100), // truncated content
                  truncated: true,
                  raw_url: 'https://gist.githubusercontent.com/raw/large.js',
                },
              },
            },
          }),
          getRevision: vi.fn(),
        },
      });
      await handleTokenSignIn(mockEvent, VALID_GHP_TOKEN);

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(fullContent),
      } as Response);

      const result = await handleGistLoad(mockEvent, {
        gistId: VALID_GIST_ID,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://gist.githubusercontent.com/raw/large.js',
      );
      expect(result.files['large.js'].content).toBe(fullContent);
      expect(result.files['large.js'].truncated).toBe(false);

      fetchSpy.mockRestore();
    });
  });

  // --- Gist list commits ---

  describe('handleGistListCommits()', () => {
    beforeEach(async () => {
      await signInForGistTests();
    });

    it('lists commits for a gist', async () => {
      const result = await handleGistListCommits(mockEvent, VALID_GIST_ID);
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Created');
      expect(result[1].title).toBe('Revision 1');
    });

    it('rejects invalid gist ID', async () => {
      await expect(handleGistListCommits(mockEvent, 'bad-id')).rejects.toThrow(
        'Invalid gist ID',
      );
      await expect(handleGistListCommits(mockEvent, 123)).rejects.toThrow(
        'Invalid gist ID',
      );
    });
  });
});
