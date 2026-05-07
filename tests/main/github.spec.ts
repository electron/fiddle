import * as fs from 'node:fs';
import * as path from 'node:path';

import { IpcMainInvokeEvent, safeStorage } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { testing } from '../../src/main/github';

const {
  handleGistCreate,
  handleGistDelete,
  handleGistListCommits,
  handleGistLoad,
  handleGistUpdate,
  handleTokenCheckAuth,
  handleTokenSignIn,
  handleTokenSignOut,
} = testing;

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

const MOCK_EVENT = {} as IpcMainInvokeEvent;

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
const INVALID_GIST_IDS = [
  'bad-id',
  123,
  null,
  undefined,
  'abc123',
  'a'.repeat(33),
  'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  'https://gist.github.com/abc123def456abc123def456abc123de',
];
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

describe('github', () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    // Reset module-level octokit state by signing out
    handleTokenSignOut(MOCK_EVENT);
  });

  // --- Token sign-in ---

  describe('handleTokenSignIn()', () => {
    it('signs in with valid token formats', async () => {
      mockOctokitInstance();

      for (const token of [VALID_GHP_TOKEN, VALID_PAT_TOKEN]) {
        const result = await handleTokenSignIn(MOCK_EVENT, token);
        expect(result).toEqual({ success: true, login: MOCK_LOGIN });

        const writePath = vi.mocked(fs.writeFileSync).mock.calls.at(-1)?.[0];
        expect(writePath).toBe(path.join('/Users/fake-user', CREDENTIALS_FILE));
      }

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('rejects an invalid token format', async () => {
      const expected = { success: false, error: 'Invalid token format.' };
      for (const token of [
        '',
        'bad-token',
        'gho_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh12',
        'ghp_' + 'a'.repeat(100),
        'ghp_tooshort',
        12345,
        [],
        ` ${VALID_GHP_TOKEN}`,
        `${VALID_GHP_TOKEN} `,
        null,
        undefined,
        {},
      ]) {
        await expect(handleTokenSignIn(MOCK_EVENT, token)).resolves.toEqual(
          expected,
        );
      }
    });

    it('rejects when encryption is unavailable', async () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);
      const result = await handleTokenSignIn(MOCK_EVENT, VALID_GHP_TOKEN);
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

      const result = await handleTokenSignIn(MOCK_EVENT, VALID_GHP_TOKEN);
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

      const result = await handleTokenSignIn(MOCK_EVENT, VALID_GHP_TOKEN);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid GitHub token');
    });
  });

  // --- Token sign-out ---

  describe('handleTokenSignOut()', () => {
    it('deletes the stored token', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const result = await handleTokenSignOut(MOCK_EVENT);
      expect(result).toEqual({ success: true });
      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('does nothing when the token file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await handleTokenSignOut(MOCK_EVENT);

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  // --- Check auth ---

  describe('handleTokenCheckAuth()', () => {
    it('returns null when decryption fails', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('corrupt');
      });

      const result = await handleTokenCheckAuth(MOCK_EVENT);

      expect(result).toEqual({ login: null });
    });

    it('returns login when a valid token is stored', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        Buffer.from(`encrypted:${VALID_GHP_TOKEN}`),
      );
      mockOctokitInstance();

      const result = await handleTokenCheckAuth(MOCK_EVENT);
      expect(result).toEqual({ login: MOCK_LOGIN });
    });

    it('returns null when no token is stored', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = await handleTokenCheckAuth(MOCK_EVENT);
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

      const result = await handleTokenCheckAuth(MOCK_EVENT);
      expect(result).toEqual({ login: null });
      // Should have deleted the invalid token
      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  // Helper to sign in and set up a fresh Octokit mock for gist tests
  async function signInForGistTests() {
    mockOctokitInstance();
    await handleTokenSignIn(MOCK_EVENT, VALID_GHP_TOKEN);
    // Clear call counts from sign-in so they don't leak into assertions
    vi.mocked(Octokit).mockClear();
    vi.mocked(fs.writeFileSync).mockClear();
  }

  // --- Gist create ---

  describe('handleGistCreate()', () => {
    beforeEach(async () => {
      await signInForGistTests();
    });

    it('creates a gist with valid descriptions', async () => {
      for (const description of ['Test fiddle', 'a'.repeat(256)]) {
        const result = await handleGistCreate(MOCK_EVENT, {
          description,
          files: VALID_FILES,
          isPublic: false,
        });

        expect(result.id).toBe(VALID_GIST_ID);
        expect(result.url).toContain('gist.github.com');
      }
    });

    it('rejects invalid parameters object', async () => {
      await expect(handleGistCreate(MOCK_EVENT, null)).rejects.toThrow(
        'Invalid parameters',
      );
      await expect(handleGistCreate(MOCK_EVENT, 'string')).rejects.toThrow(
        'Invalid parameters',
      );
    });

    it('rejects invalid description', async () => {
      for (const description of ['', 'a'.repeat(257), null, 123]) {
        await expect(
          handleGistCreate(MOCK_EVENT, {
            description,
            files: VALID_FILES,
            isPublic: false,
          }),
        ).rejects.toThrow('Invalid description');
      }
    });

    it('rejects invalid files', async () => {
      const invalidFiles = [
        {},
        { 'main.js': { filename: 'sneaky.js', content: 'code' } },
        { '': { filename: '', content: 'code' } },
        { 'main.js': { filename: 'main.js', content: 123 } },
        {
          'main.js': {
            filename: 'main.js',
            content: 'x'.repeat(10 * 1024 * 1024 + 1),
          },
        },
        Object.fromEntries(
          Array.from({ length: 301 }, (_, index) => {
            const filename = `file${index}.js`;
            return [filename, { filename, content: 'x' }];
          }),
        ),
      ];

      for (const files of invalidFiles) {
        await expect(
          handleGistCreate(MOCK_EVENT, {
            description: 'Test',
            files,
            isPublic: false,
          }),
        ).rejects.toThrow('Invalid files');
      }
    });

    it('rejects non-boolean isPublic', async () => {
      await expect(
        handleGistCreate(MOCK_EVENT, {
          description: 'Test',
          files: VALID_FILES,
          isPublic: 'yes',
        }),
      ).rejects.toThrow('isPublic must be a boolean');
    });

    it('throws when not authenticated', async () => {
      await handleTokenSignOut(MOCK_EVENT);
      await expect(
        handleGistCreate(MOCK_EVENT, {
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
      const result = await handleGistUpdate(MOCK_EVENT, {
        gistId: VALID_GIST_ID,
        files: {
          'main.js': { filename: 'main.js', content: 'new code' },
          'old.js': null,
        },
      });

      expect(result.id).toBe(VALID_GIST_ID);
    });

    it('rejects invalid gist ID', async () => {
      for (const gistId of INVALID_GIST_IDS) {
        await expect(
          handleGistUpdate(MOCK_EVENT, {
            gistId,
            files: VALID_FILES,
          }),
        ).rejects.toThrow('Invalid gist ID');
      }
    });

    it('rejects invalid files', async () => {
      const invalidFiles = [
        {},
        { 'main.js': { filename: 'sneaky.js', content: 'code' } },
        { 'main.js': { filename: 'main.js', content: 123 } },
      ];

      for (const files of invalidFiles) {
        await expect(
          handleGistUpdate(MOCK_EVENT, {
            gistId: VALID_GIST_ID,
            files,
          }),
        ).rejects.toThrow('Invalid files');
      }

      await expect(
        handleGistUpdate(MOCK_EVENT, {
          gistId: VALID_GIST_ID,
          files: 'not-an-object',
        }),
      ).rejects.toThrow('Invalid files');
    });

    it('rejects invalid parameters object', async () => {
      await expect(handleGistUpdate(MOCK_EVENT, null)).rejects.toThrow(
        'Invalid parameters',
      );
    });
  });

  // --- Gist delete ---

  describe('handleGistDelete()', () => {
    beforeEach(async () => {
      await signInForGistTests();
    });

    it('deletes gists with valid IDs', async () => {
      for (const gistId of [
        VALID_GIST_ID,
        'AABBCCDDEE11223344556677889900FF',
      ]) {
        const result = await handleGistDelete(MOCK_EVENT, gistId);
        expect(result).toEqual({ success: true });
      }
    });

    it('rejects invalid gist ID', async () => {
      for (const gistId of INVALID_GIST_IDS) {
        await expect(handleGistDelete(MOCK_EVENT, gistId)).rejects.toThrow(
          'Invalid gist ID',
        );
      }
    });
  });

  // --- Gist load ---

  describe('handleGistLoad()', () => {
    beforeEach(async () => {
      // Sign in so getOctokit() returns the authenticated instance
      await signInForGistTests();
    });

    it('loads a gist by ID', async () => {
      const result = await handleGistLoad(MOCK_EVENT, {
        gistId: VALID_GIST_ID,
      });

      expect(result.id).toBe(VALID_GIST_ID);
      expect(result.files['main.js'].content).toBe('console.log("hi")');
    });

    it('loads a gist at a specific revision', async () => {
      const result = await handleGistLoad(MOCK_EVENT, {
        gistId: VALID_GIST_ID,
        revision: VALID_SHA,
      });

      expect(result.id).toBe(VALID_GIST_ID);
    });

    it('rejects invalid gist IDs', async () => {
      for (const gistId of INVALID_GIST_IDS) {
        await expect(handleGistLoad(MOCK_EVENT, { gistId })).rejects.toThrow(
          'Invalid gist ID',
        );
      }
    });

    it('rejects invalid revision SHA', async () => {
      await expect(
        handleGistLoad(MOCK_EVENT, {
          gistId: VALID_GIST_ID,
          revision: 'not-a-sha',
        }),
      ).rejects.toThrow('Invalid revision SHA');
    });

    it('loads a gist with valid or omitted revision', async () => {
      for (const revision of [VALID_SHA, undefined]) {
        const result = await handleGistLoad(MOCK_EVENT, {
          gistId: VALID_GIST_ID,
          revision,
        });

        expect(result.id).toBe(VALID_GIST_ID);
      }
    });

    it('rejects invalid revision SHA values', async () => {
      for (const revision of ['abc123', null, 'a'.repeat(41), 'A'.repeat(40)]) {
        await expect(
          handleGistLoad(MOCK_EVENT, {
            gistId: VALID_GIST_ID,
            revision,
          }),
        ).rejects.toThrow('Invalid revision SHA');
      }
    });

    it('rejects invalid parameters object', async () => {
      await expect(handleGistLoad(MOCK_EVENT, null)).rejects.toThrow(
        'Invalid parameters',
      );
    });

    it('works without authentication (public gists)', async () => {
      // Sign out, then set up a fresh mock so new Octokit() works
      await handleTokenSignOut(MOCK_EVENT);
      mockOctokitInstance();

      const result = await handleGistLoad(MOCK_EVENT, {
        gistId: VALID_GIST_ID,
      });
      expect(result.id).toBe(VALID_GIST_ID);
    });

    it('fetches full content for truncated files', async () => {
      const fullContent = 'a'.repeat(2000);

      // Sign out and re-sign-in with a mock that returns a truncated file
      await handleTokenSignOut(MOCK_EVENT);
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
      await handleTokenSignIn(MOCK_EVENT, VALID_GHP_TOKEN);

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(fullContent),
      } as Response);

      const result = await handleGistLoad(MOCK_EVENT, {
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
      const result = await handleGistListCommits(MOCK_EVENT, VALID_GIST_ID);
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Created');
      expect(result[1].title).toBe('Revision 1');
    });

    it('rejects invalid gist IDs', async () => {
      for (const gistId of INVALID_GIST_IDS) {
        await expect(handleGistListCommits(MOCK_EVENT, gistId)).rejects.toThrow(
          'Invalid gist ID',
        );
      }
    });
  });
});
