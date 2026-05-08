import * as fs from 'node:fs';

import { IpcMainInvokeEvent, app, safeStorage } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GIST_MAX_FILE_COUNT, GIST_MAX_FILE_SIZE } from '../../src/constants';
import { getTemplate } from '../../src/main/content';
import { testing } from '../../src/main/github';
import * as tmp from '../../src/main/utils/tmp';

const {
  fetchExample,
  getCredentialsPath,
  handleGistCreate,
  handleGistDelete,
  handleGistListCommits,
  handleGistLoad,
  handleGistUpdate,
  handleTokenCheckAuth,
  handleTokenSignIn,
  handleTokenSignOut,
  loadToken,
  saveToken,
} = testing;

vi.mock('@octokit/rest', () => {
  const MockOctokit = vi.fn();
  return { Octokit: MockOctokit };
});
vi.unmock('fs-extra');

const MOCK_EVENT = {} as IpcMainInvokeEvent;

// Import Octokit so we can mock its constructor
const { Octokit } = await import('@octokit/rest');

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
const VALID_FILES = {
  'main.js': { filename: 'main.js', content: 'code' },
};
let userDataPath: string;

function mockOctokitInstance(overrides: Record<string, any> = {}) {
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

describe('github', () => {
  beforeEach(async () => {
    userDataPath = tmp.dirSync({ prefix: 'electron-fiddle-github-' });
    app.setPath('userData', userDataPath);

    // Confirm that the folder we just created will hold the credentials file
    expect(getCredentialsPath().startsWith(userDataPath)).toBe(true);
    expect(loadToken()).toBeNull();
  });

  afterEach(async () => {
    await handleTokenSignOut(MOCK_EVENT);
    fs.rmSync(userDataPath, { recursive: true, force: true });
  });

  describe('handleTokenSignIn()', () => {
    it('saves encrypted tokens to a permission-protected userData file', async () => {
      mockOctokitInstance();
      expect(loadToken()).toBeNull();

      for (const token of [VALID_GHP_TOKEN, VALID_PAT_TOKEN]) {
        const result = await handleTokenSignIn(MOCK_EVENT, token);
        expect(result).toEqual({ success: true, login: MOCK_LOGIN });

        const encrypted = safeStorage.encryptString(token);
        expect(loadToken()).toBe(token);
        expect(fs.readFileSync(getCredentialsPath())).toEqual(encrypted);
        // POSIX permission bits aren't meaningful on Windows
        if (process.platform !== 'win32')
          expect(fs.statSync(getCredentialsPath()).mode & 0o777).toBe(0o600);
      }
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

  describe('handleTokenSignOut()', () => {
    it('deletes the stored token', async () => {
      // setup: set a token & confirm it loads
      saveToken(VALID_GHP_TOKEN);
      expect(loadToken()).toBe(VALID_GHP_TOKEN);

      const expected = { success: true };
      await expect(handleTokenSignOut(MOCK_EVENT)).resolves.toEqual(expected);
      expect(loadToken()).toBeNull();
    });
  });

  describe('handleTokenCheckAuth()', () => {
    it('returns null when decryption fails', async () => {
      saveToken(VALID_GHP_TOKEN);
      vi.mocked(safeStorage.decryptString).mockImplementationOnce(() => {
        throw new Error('corrupt');
      });
      const result = await handleTokenCheckAuth(MOCK_EVENT);
      expect(result).toEqual({ login: null });
    });

    it('returns login when a valid token is stored', async () => {
      saveToken(VALID_GHP_TOKEN);
      mockOctokitInstance();
      const result = await handleTokenCheckAuth(MOCK_EVENT);
      expect(result).toEqual({ login: MOCK_LOGIN });
    });

    it('returns null when no token is stored', async () => {
      // setup: confirm there's no token
      expect(loadToken()).toBeNull();

      const result = await handleTokenCheckAuth(MOCK_EVENT);
      expect(result).toEqual({ login: null });
    });

    it('cleans up and returns null for expired tokens', async () => {
      saveToken(VALID_GHP_TOKEN);
      mockOctokitInstance({
        users: {
          getAuthenticated: vi
            .fn()
            .mockRejectedValue(
              Object.assign(new Error('Bad credentials'), { status: 401 }),
            ),
        },
      });

      const result = await handleTokenCheckAuth(MOCK_EVENT);
      expect(result).toEqual({ login: null });
      expect(loadToken()).toBeNull();
    });

    it('preserves the token for transient auth-check failures', async () => {
      saveToken(VALID_GHP_TOKEN);
      mockOctokitInstance({
        users: {
          getAuthenticated: vi.fn().mockRejectedValue(new Error('offline')),
        },
      });

      const result = await handleTokenCheckAuth(MOCK_EVENT);

      expect(result).toEqual({ login: null });
      expect(loadToken()).toBe(VALID_GHP_TOKEN);
    });
  });

  // Helper to sign in and set up a fresh Octokit mock for gist tests
  async function signInForGistTests() {
    mockOctokitInstance();
    await handleTokenSignIn(MOCK_EVENT, VALID_GHP_TOKEN);
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
            content: 'x'.repeat(GIST_MAX_FILE_SIZE + 1),
          },
        },
        Object.fromEntries(
          Array.from({ length: GIST_MAX_FILE_COUNT + 1 }, (_, index) => {
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
        await expect(
          handleGistDelete(MOCK_EVENT, gistId),
        ).resolves.toBeUndefined();
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

      expect(result.files['main.js'].content).toBe('console.log("hi")');
    });

    it('loads a gist at a specific revision', async () => {
      const result = await handleGistLoad(MOCK_EVENT, {
        gistId: VALID_GIST_ID,
        revision: VALID_SHA,
      });

      expect(result.revision).toBe('sha1');
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

        expect(result.revision).toBe('sha1');
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
      expect(result.files['main.js'].content).toBe('console.log("hi")');
    });

    it('fetches full content for truncated files', async () => {
      // This is the largest allowable size a gist file can be
      const fullContent = 'a'.repeat(GIST_MAX_FILE_SIZE);

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

    it('always keeps the initial revision even with empty change_status', async () => {
      await handleTokenSignOut(MOCK_EVENT);
      mockOctokitInstance({
        gists: {
          listCommits: vi.fn().mockResolvedValue({
            data: [
              {
                version: 'sha2',
                committed_at: '2026-02-05T12:00:00Z',
                change_status: { additions: 5, deletions: 2, total: 7 },
              },
              {
                version: 'sha1',
                committed_at: '2026-02-01T10:00:00Z',
                change_status: { additions: 0, deletions: 0, total: 0 },
              },
            ],
          }),
        },
      });
      await handleTokenSignIn(MOCK_EVENT, VALID_GHP_TOKEN);

      const result = await handleGistListCommits(MOCK_EVENT, VALID_GIST_ID);

      // The initial revision should NOT be filtered out.
      expect(result).toHaveLength(2);
      expect(result[0].sha).toBe('sha1');
      expect(result[0].title).toBe('Created');
    });

    it('filters out empty revisions except the initial one', async () => {
      await handleTokenSignOut(MOCK_EVENT);
      mockOctokitInstance({
        gists: {
          listCommits: vi.fn().mockResolvedValue({
            data: [
              {
                version: 'sha3',
                committed_at: '2026-02-10T12:00:00Z',
                change_status: { additions: 3, deletions: 1, total: 4 },
              },
              {
                version: 'sha2',
                committed_at: '2026-02-05T12:00:00Z',
                change_status: { additions: 0, deletions: 0, total: 0 },
              },
              {
                version: 'sha1',
                committed_at: '2026-02-01T10:00:00Z',
                change_status: { additions: 0, deletions: 0, total: 0 },
              },
            ],
          }),
        },
      });
      await handleTokenSignIn(MOCK_EVENT, VALID_GHP_TOKEN);

      const result = await handleGistListCommits(MOCK_EVENT, VALID_GIST_ID);

      // sha2 (empty, not initial) is dropped; sha1 (initial) and sha3 are kept.
      expect(result).toHaveLength(2);
      expect(result[0].sha).toBe('sha1');
      expect(result[1].sha).toBe('sha3');
    });

    it('rejects invalid gist IDs', async () => {
      for (const gistId of INVALID_GIST_IDS) {
        await expect(handleGistListCommits(MOCK_EVENT, gistId)).rejects.toThrow(
          'Invalid gist ID',
        );
      }
    });
  });

  // --- Fetch example ---

  describe('fetchExample()', () => {
    const REF = 'example-template';
    const EXAMPLE_PATH = 'docs/fiddles/quick-start';
    const TEMPLATE_VERSION = REF.replace(/^v/, '');

    function makeFolderEntry(name: string, downloadUrl: string | null = null) {
      return {
        name,
        download_url: downloadUrl ?? `https://example.test/${name}`,
      };
    }

    function mockFetchResponses(map: Record<string, string>) {
      return vi
        .spyOn(global, 'fetch')
        .mockImplementation(async (input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          const body = map[url];
          if (body === undefined) {
            return { ok: false, status: 404, text: async () => '' } as Response;
          }
          return { ok: true, status: 200, text: async () => body } as Response;
        });
    }

    it('overlays downloaded supported files onto the template', async () => {
      const folder = [
        makeFolderEntry('main.js'),
        makeFolderEntry('index.html'),
      ];
      const getContent = vi.fn().mockResolvedValue({ data: folder });
      mockOctokitInstance({ repos: { getContent } });

      const fetchSpy = mockFetchResponses({
        'https://example.test/main.js': '// example main',
        'https://example.test/index.html': '<!-- example html -->',
      });

      const templateValues = await getTemplate(TEMPLATE_VERSION);
      const result = await fetchExample(REF, EXAMPLE_PATH);

      expect(getContent).toHaveBeenCalledWith({
        owner: 'electron',
        repo: 'electron',
        path: EXAMPLE_PATH,
        ref: REF,
      });
      // Overridden values come from the example.
      expect(result['main.js']).toBe('// example main');
      expect(result['index.html']).toBe('<!-- example html -->');
      // Files not in the example fall back to template values.
      expect(result['renderer.js']).toBe(templateValues['renderer.js']);
      expect(result['package.json']).toBe(templateValues['package.json']);

      fetchSpy.mockRestore();
    });

    it('skips unsupported file types', async () => {
      const folder = [
        makeFolderEntry('main.js'),
        makeFolderEntry('README.md'),
        makeFolderEntry('image.png'),
      ];
      const getContent = vi.fn().mockResolvedValue({ data: folder });
      mockOctokitInstance({ repos: { getContent } });

      const fetchSpy = mockFetchResponses({
        'https://example.test/main.js': '// example main',
      });

      const result = await fetchExample(REF, EXAMPLE_PATH);

      // Only the supported file should be fetched.
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith('https://example.test/main.js');
      expect(result['main.js']).toBe('// example main');

      fetchSpy.mockRestore();
    });

    it('skips entries that lack a download_url', async () => {
      const folder = [
        // Subdirectory: no download_url even though the name looks supported.
        { name: 'nested.js', download_url: null },
        makeFolderEntry('main.js'),
      ];
      const getContent = vi.fn().mockResolvedValue({ data: folder });
      mockOctokitInstance({ repos: { getContent } });

      const fetchSpy = mockFetchResponses({
        'https://example.test/main.js': '// example main',
      });

      const result = await fetchExample(REF, EXAMPLE_PATH);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result['main.js']).toBe('// example main');

      fetchSpy.mockRestore();
    });

    it('throws when the path resolves to a single file (data is not an array)', async () => {
      const getContent = vi.fn().mockResolvedValue({
        data: { name: 'main.js', download_url: 'https://example.test/main.js' },
      });
      mockOctokitInstance({ repos: { getContent } });

      await expect(fetchExample(REF, EXAMPLE_PATH)).rejects.toThrow(
        'is not a valid example',
      );
    });

    it('throws when a file download fails', async () => {
      const folder = [makeFolderEntry('main.js')];
      const getContent = vi.fn().mockResolvedValue({ data: folder });
      mockOctokitInstance({ repos: { getContent } });

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => '',
      } as Response);

      await expect(fetchExample(REF, EXAMPLE_PATH)).rejects.toThrow(
        /Failed to download main\.js: 500/,
      );

      fetchSpy.mockRestore();
    });

    it('propagates errors from getContent', async () => {
      const getContent = vi.fn().mockRejectedValue(new Error('Not Found'));
      mockOctokitInstance({ repos: { getContent } });

      await expect(fetchExample(REF, EXAMPLE_PATH)).rejects.toThrow(
        'Not Found',
      );
    });

    it('rejects an empty ref', async () => {
      mockOctokitInstance({ repos: { getContent: vi.fn() } });
      await expect(fetchExample('', EXAMPLE_PATH)).rejects.toThrow(
        'Invalid ref',
      );
    });

    it('rejects an empty path', async () => {
      mockOctokitInstance({ repos: { getContent: vi.fn() } });
      await expect(fetchExample(REF, '')).rejects.toThrow('Invalid path');
    });

    it('returns a fresh object that does not mutate the template', async () => {
      const folder = [makeFolderEntry('main.js')];
      const getContent = vi.fn().mockResolvedValue({ data: folder });
      mockOctokitInstance({ repos: { getContent } });

      const templateValues = await getTemplate(TEMPLATE_VERSION);

      const fetchSpy = mockFetchResponses({
        'https://example.test/main.js': '// example main',
      });

      const result = await fetchExample(REF, EXAMPLE_PATH);

      expect(result).not.toBe(templateValues);
      expect(templateValues['main.js']).not.toBe('// example main');
      expect(result['main.js']).toBe('// example main');
      expect(await getTemplate(TEMPLATE_VERSION)).toEqual(templateValues);

      fetchSpy.mockRestore();
    });
  });
});
