import { Octokit } from '@octokit/rest';
import { mocked } from 'jest-mock';

import {
  EditorValues,
  ElectronReleaseChannel,
  InstallState,
  MAIN_JS,
  PACKAGE_NAME,
  RunnableVersion,
  VersionSource,
} from '../../src/interfaces';
import { RemoteLoader } from '../../src/renderer/remote-loader';
import { AppState } from '../../src/renderer/state';
import {
  isKnownFile,
  isSupportedFile,
} from '../../src/renderer/utils/editor-utils';
import { getOctokit } from '../../src/renderer/utils/octokit';
import { AppMock, StateMock, createEditorValues } from '../mocks/mocks';
import { FetchMock } from '../utils';

jest.mock('../../src/renderer/utils/octokit');

type GistFile = { content: string; truncated?: boolean; raw_url?: string };
type GistFiles = { [id: string]: GistFile };

describe('RemoteLoader', () => {
  let instance: RemoteLoader;
  let app: AppMock;
  let store: StateMock;
  let mockGistFiles: GistFiles;
  let mockGetGists: { get: () => Promise<{ files: GistFiles }> };
  let mockRepos: Array<{ name: string; download_url: string }>;
  let mockGetRepos: { getContents: () => Promise<{ data: typeof mockRepos }> };
  let editorValues: EditorValues;

  beforeEach(() => {
    app = window.app as unknown as AppMock;
    ({ state: store } = app);
    store.channelsToShow = [ElectronReleaseChannel.stable];
    store.initVersions('4.0.0', {
      '4.0.0': { version: '4.0.0' } as RunnableVersion,
      '4.0.0-beta': { version: '4.0.0-beta' } as RunnableVersion,
    });
    instance = new RemoteLoader(store as unknown as AppState);

    editorValues = createEditorValues();

    mockGistFiles = Object.fromEntries(
      Object.entries(editorValues).map(([id, content]) => [
        id,
        { content: content as string },
      ]),
    );
    mockGetGists = {
      get: jest.fn().mockResolvedValue({ data: { files: mockGistFiles } }),
    };

    mockRepos = [
      ...Object.keys(editorValues).map((name) => ({
        name,
        download_url: `https://${name}`,
      })),
      { name: 'stuff', download_url: 'https://google.com/' },
    ];
    mockGetRepos = {
      getContents: jest.fn().mockResolvedValue({ data: mockRepos }),
    };
  });

  describe('fetchGistAndLoad()', () => {
    it('loads a fiddle', async () => {
      const gistId = 'abcdtestid';
      mocked(getOctokit).mockResolvedValue({
        gists: mockGetGists,
      } as unknown as Octokit);
      store.gistId = gistId;

      const result = await instance.fetchGistAndLoad(gistId);

      expect(result).toBe(true);
      expect(app.replaceFiddle).toBeCalledWith(editorValues, { gistId });
    });

    it('handles bad JSON in package.json', async () => {
      const gistId = 'badjsontestid';
      const badPj =
        '{"main":"main.js","devDependencies":{"electron":"17.0.0",}}';

      store.gistId = gistId;
      mockGistFiles[PACKAGE_NAME] = { content: badPj };
      mockRepos.push({
        name: PACKAGE_NAME,
        download_url: `https://${PACKAGE_NAME}`,
      });

      mocked(getOctokit).mockResolvedValue({
        gists: mockGetGists,
      } as unknown as Octokit);

      const result = await instance.fetchGistAndLoad(gistId);
      expect(result).toBe(false);
      expect(store.showErrorDialog).toHaveBeenCalledWith(
        expect.stringMatching(/Invalid JSON found in package.json/i),
      );
    });

    it('handles gist fiddle devDependencies', async () => {
      const gistId = 'pjsontestid';
      const pj = {
        main: MAIN_JS,
        devDependencies: {
          electron: '17.0.0',
        },
      };

      store.gistId = gistId;
      mockGistFiles[PACKAGE_NAME] = { content: JSON.stringify(pj, null, 2) };
      mockRepos.push({
        name: PACKAGE_NAME,
        download_url: `https://${PACKAGE_NAME}`,
      });

      mocked(getOctokit).mockResolvedValue({
        gists: mockGetGists,
      } as unknown as Octokit);

      const result = await instance.fetchGistAndLoad(gistId);

      expect(result).toBe(true);
      expect(store.modules.size).toEqual(0);
    });

    it('throws an error when a user loads a gist with no supported files', async () => {
      const gistId = 'abcdtestid';

      store.showErrorDialog = jest.fn().mockResolvedValueOnce(true);
      const errorGetGists = {
        get: jest.fn().mockResolvedValue({
          data: {
            files: {
              'blah.blah': { content: '' },
              'yes.no': { content: '' },
            },
          },
        }),
      };
      mocked(getOctokit).mockResolvedValue({
        gists: errorGetGists,
      } as unknown as Octokit);
      store.gistId = gistId;

      const result = await instance.fetchGistAndLoad(gistId);
      expect(result).toBe(false);
      expect(store.showErrorDialog).toHaveBeenCalledWith(
        expect.stringMatching(
          /This Gist did not contain any supported files. Supported files must have one of the following extensions: .cjs, .js, .mjs, .css, or .html/i,
        ),
      );
    });

    it('sets the Electron version from package.json', async () => {
      const gistId = 'pjsontestid';
      const pj = {
        main: MAIN_JS,
        devDependencies: {
          electron: '17.0.0',
        },
      };

      store.gistId = gistId;
      mockGistFiles[PACKAGE_NAME] = { content: JSON.stringify(pj, null, 2) };
      mockRepos.push({
        name: PACKAGE_NAME,
        download_url: `https://${PACKAGE_NAME}`,
      });

      mocked(getOctokit).mockResolvedValue({
        gists: mockGetGists,
      } as unknown as Octokit);
      mocked(window.ElectronFiddle.isReleasedMajor).mockResolvedValue(true);

      const result = await instance.fetchGistAndLoad(gistId);

      expect(result).toBe(true);
      expect(store.modules.size).toEqual(0);
      expect(store.setVersion).toBeCalledWith('17.0.0');
    });

    it('handles gists with files over 1mb', async () => {
      const gistId = 'toobig';
      const filename = 'index.js';
      const content = 'hello im huge';

      editorValues[filename] = content;
      mockGistFiles[filename] = {
        truncated: true,
        content: 'truncated',
        raw_url: 'https://gist.githubusercontent.com/IMTOOBIG',
      };

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        text: () => Promise.resolve(content),
      } as Response);

      mocked(getOctokit).mockResolvedValue({
        gists: mockGetGists,
      } as unknown as Octokit);
      instance.confirmAddFile = jest.fn().mockResolvedValue(true);

      const result = await instance.fetchGistAndLoad(gistId);
      expect(result).toBe(true);
      expect(app.replaceFiddle).toBeCalledWith(editorValues, { gistId });
    });

    it('does not set an invalid Electron version from package.json', async () => {
      const gistId = 'pjsontestid';
      const pj = {
        main: MAIN_JS,
        devDependencies: {
          electron: '99999.0.0',
        },
      };

      store.gistId = gistId;
      mockGistFiles[PACKAGE_NAME] = { content: JSON.stringify(pj, null, 2) };
      mockRepos.push({
        name: PACKAGE_NAME,
        download_url: `https://${PACKAGE_NAME}`,
      });

      mocked(getOctokit).mockResolvedValue({
        gists: mockGetGists,
      } as unknown as Octokit);

      const result = await instance.fetchGistAndLoad(gistId);

      expect(result).toBe(true);
      expect(store.modules.size).toEqual(0);
      expect(store.showGenericDialog).toBeCalledWith({
        label: `The Electron version (99999.0.0) in this gist's package.json is invalid. Falling back to last used version.`,
        ok: 'Close',
        type: 'warning',
        wantsInput: false,
      });
    });

    it('handles extra gist fiddle dependencies', async () => {
      const gistId = 'pjsontestid';
      const pj = {
        main: MAIN_JS,
        dependencies: {
          'meaning-of-life': '*',
        },
        devDependencies: {
          electron: '17.0.0',
          chalk: '*',
        },
      };

      store.gistId = gistId;
      mockGistFiles[PACKAGE_NAME] = { content: JSON.stringify(pj, null, 2) };
      mockRepos.push({
        name: PACKAGE_NAME,
        download_url: `https://${PACKAGE_NAME}`,
      });

      mocked(getOctokit).mockResolvedValue({
        gists: mockGetGists,
      } as unknown as Octokit);

      const result = await instance.fetchGistAndLoad(gistId);

      expect(result).toBe(true);
      expect(store.modules.size).toEqual(2);
      expect(store.modules.get('meaning-of-life')).toEqual('*');
      expect(store.modules.get('chalk')).toEqual('*');
      expect(store.modules.has('electron')).toEqual(false);
    });

    it('loads a fiddle with a new JS file', async () => {
      // setup: adding a new supported file
      const filename = 'file.js';
      const content = '// hello!';
      const gistId = 'customtestid';
      expect(isKnownFile(filename)).toBe(false);
      expect(isSupportedFile(filename)).toBe(true);

      store.gistId = gistId;

      editorValues[filename] = content;
      mockGistFiles[filename] = { content };
      mockRepos.push({
        name: filename,
        download_url: `https://${filename}`,
      });

      mocked(getOctokit).mockResolvedValue({
        gists: mockGetGists,
      } as unknown as Octokit);
      instance.confirmAddFile = jest.fn().mockResolvedValue(true);

      const result = await instance.fetchGistAndLoad(gistId);

      expect(result).toBe(true);
      expect(app.replaceFiddle).toBeCalledWith(editorValues, { gistId });
    });

    it('loads a fiddle with a new JSON file', async () => {
      const filename = 'data.json';
      const content = '{"test": "hello!"}';
      const gistId = 'customtestid';
      expect(isKnownFile(filename)).toBe(false);
      expect(isSupportedFile(filename)).toBe(true);

      store.gistId = gistId;

      editorValues[filename] = content;
      mockGistFiles[filename] = { content };
      mockRepos.push({
        name: filename,
        download_url: `https://${filename}`,
      });

      mocked(getOctokit).mockResolvedValue({
        gists: mockGetGists,
      } as unknown as Octokit);
      instance.confirmAddFile = jest.fn().mockResolvedValue(true);

      const result = await instance.fetchGistAndLoad(gistId);

      expect(result).toBe(true);
      expect(app.replaceFiddle).toBeCalledWith(editorValues, { gistId });
    });

    it('handles an error', async () => {
      mocked(getOctokit).mockResolvedValue({
        gists: {
          get: async () => {
            throw new Error('Bwap bwap');
          },
        },
      } as unknown as Octokit);

      const result = await instance.fetchGistAndLoad('abcdtestid');
      expect(result).toBe(false);
    });
  });

  describe('fetchExampleAndLoad()', () => {
    let fetchMock: FetchMock;

    beforeEach(() => {
      instance.setElectronVersion = jest.fn().mockReturnValueOnce(true);
      fetchMock = new FetchMock();
      for (const { name, download_url } of mockRepos) {
        fetchMock.add(download_url, name);
      }
    });

    it('loads an Electron example', async () => {
      mocked(window.ElectronFiddle.getTemplate).mockResolvedValue({
        [MAIN_JS]: '// content',
      });

      mocked(getOctokit).mockResolvedValue({
        repos: mockGetRepos,
      } as unknown as Octokit);

      await instance.fetchExampleAndLoad('v4.0.0', 'test/path');

      const expectedValues: Record<string, string> = {};
      for (const filename of Object.keys(mockGistFiles)) {
        expectedValues[filename] = filename;
      }
      expect(app.replaceFiddle).toHaveBeenCalledTimes(1);
      expect(app.replaceFiddle).toHaveBeenCalledWith(
        expectedValues,
        expect.anything(),
      );
      expect(instance.setElectronVersion).toBeCalledWith('4.0.0');
    });

    it('handles an error', async () => {
      mocked(getOctokit).mockResolvedValue({
        repos: {
          getContents: async () => {
            throw new Error('Bwap bwap');
          },
        },
      } as unknown as Octokit);

      const result = await instance.fetchExampleAndLoad('v4.0.0', 'test/path');
      expect(result).toBe(false);
    });

    it('handles incorrect results', async () => {
      store.showErrorDialog = jest.fn().mockResolvedValueOnce(true);
      mocked(getOctokit).mockResolvedValue({
        repos: {
          getContents: async () => ({
            not_an_array: true,
          }),
        },
      } as unknown as Octokit);

      const result = await instance.fetchExampleAndLoad('v4.0.0', 'test/path');
      expect(result).toBe(false);
      expect(store.showErrorDialog).toHaveBeenCalledWith(
        expect.stringMatching(/not a valid/i),
      );
    });
  });

  describe('setElectronVersion()', () => {
    it('sets version from ref if release channel enabled', async () => {
      store.showConfirmDialog = jest.fn().mockResolvedValueOnce(true);

      const result = await instance.setElectronVersion('4.0.0');
      expect(result).toBe(true);
      expect(store.setVersion).toBeCalledWith('4.0.0');
    });

    it('enables release channel when authorized', async () => {
      instance.verifyReleaseChannelEnabled = jest.fn().mockResolvedValue(true);

      const result = await instance.setElectronVersion('4.0.0-beta');
      expect(result).toBe(true);
      expect(store.channelsToShow).toContain(ElectronReleaseChannel.beta);
    });

    it('tries to download missing versions of Electron', async () => {
      const version = '5.0.0';

      const result = await instance.setElectronVersion(version);
      expect(result).toBe(true);
      expect(store.addNewVersions).toBeCalledWith([
        {
          source: VersionSource.remote,
          state: InstallState.missing,
          version,
        },
      ]);
      expect(store.setVersion).toBeCalledWith(version);
    });
  });

  describe('verifyReleaseChannelEnabled', () => {
    it('asks the user if they want to enable a release channel', async () => {
      store.showConfirmDialog = jest.fn().mockResolvedValueOnce(true);
      await instance.verifyReleaseChannelEnabled(ElectronReleaseChannel.beta);
      expect(store.showConfirmDialog).toHaveBeenCalledWith({
        label: expect.stringMatching(/enable the release channel/i),
        ok: 'Enable',
      });
    });
  });

  describe('loadFiddleFromElectronExample()', () => {
    it('loads the example with confirmation', async () => {
      store.showConfirmDialog = jest.fn().mockResolvedValueOnce(true);
      instance.verifyReleaseChannelEnabled = jest.fn().mockResolvedValue(true);
      instance.fetchExampleAndLoad = jest.fn();
      await instance.loadFiddleFromElectronExample({
        path: 'test/path',
        tag: 'v4.0.0',
      });

      expect(store.showConfirmDialog).toHaveBeenCalledWith({
        label: expect.stringMatching(/for version v4.0.0/i),
        ok: 'Load',
      });
      expect(instance.fetchExampleAndLoad).toHaveBeenCalledWith(
        'v4.0.0',
        'test/path',
      );
    });

    it('does not load the example without confirmation', async () => {
      store.showConfirmDialog = jest.fn().mockResolvedValueOnce(false);
      instance.verifyReleaseChannelEnabled = jest.fn();
      instance.fetchExampleAndLoad = jest.fn();
      await instance.loadFiddleFromElectronExample({
        path: 'test/path',
        tag: 'v4.0.0',
      });

      expect(store.showConfirmDialog).toHaveBeenCalled();
      expect(instance.fetchExampleAndLoad).toHaveBeenCalledTimes(0);
    });
  });

  describe('loadFiddleFromGist()', () => {
    it('loads the example with confirmation', async () => {
      store.showConfirmDialog = jest.fn().mockResolvedValueOnce(true);
      instance.fetchGistAndLoad = jest.fn();
      await instance.loadFiddleFromGist({ id: 'gist' });

      expect(instance.fetchGistAndLoad).toHaveBeenCalledWith('gist');
      expect(store.showConfirmDialog).toHaveBeenCalledWith({
        label: expect.stringMatching(/are you sure/i),
        ok: 'Load',
      });
    });

    it('does not load the example without confirmation', async () => {
      store.showConfirmDialog = jest.fn().mockResolvedValueOnce(false);
      instance.fetchGistAndLoad = jest.fn();
      await instance.loadFiddleFromGist({ id: 'gist' });

      expect(instance.fetchGistAndLoad).not.toHaveBeenCalled();
      expect(store.showConfirmDialog).toHaveBeenCalled();
    });
  });
});
