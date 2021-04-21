import { observable } from 'mobx';
import {
  EditorValues,
  ElectronReleaseChannel,
  GenericDialogType,
} from '../../src/interfaces';
import { RemoteLoader } from '../../src/renderer/remote-loader';
import { getOctokit } from '../../src/utils/octokit';
import { ipcRendererManager } from '../../src/renderer/ipc';

import { AppMock } from '../mocks/app';
import { createEditorValues } from '../mocks/editor-values';
import { mockFetchOnce } from '../utils';

jest.mock('../../src/utils/octokit');

class MockStore {
  @observable public isGenericDialogShowing = false;
  public setGenericDialogOptions = jest.fn();
  public toggleGenericDialog = jest.fn();
  public versions = {
    '4.0.0': {
      version: '4.0.0',
    },
    '4.0.0-beta': {
      version: '4.0.0-beta',
    },
  };
  public channelsToShow = [ElectronReleaseChannel.stable];
  public setVersion = jest.fn();
  public hasVersion = (version: string) => !!this.versions[version];
}

describe('RemoteLoader', () => {
  let app: AppMock;
  let instance: RemoteLoader;
  let store: any;
  let mockGistFiles: any;
  let mockGetGists: any;
  let mockRepos: any;
  let mockGetRepos: any;
  let editorValues: EditorValues;

  beforeEach(() => {
    ipcRendererManager.send = jest.fn();

    ({ app } = (window as any).ElectronFiddle);
    store = new MockStore() as any;
    app.state = store;

    instance = new RemoteLoader(store);

    (global.fetch as jest.Mock).mockResolvedValue({
      text: () => Promise.resolve('hello'),
    });

    editorValues = createEditorValues();

    mockGistFiles = Object.fromEntries(
      Object.entries(editorValues).map(([id, content]) => [id, { content }]),
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

  afterEach(() => {
    ipcRendererManager.removeAllListeners();
  });

  describe('fetchGistAndLoad()', () => {
    it('loads a fiddle', async () => {
      const gistId = 'abctestid';
      (getOctokit as jest.Mock).mockReturnValue({ gists: mockGetGists });
      store.gistId = 'abcdtestid';

      const result = await instance.fetchGistAndLoad(gistId);

      expect(result).toBe(true);
      expect(app.replaceFiddle).toBeCalledWith(editorValues, { gistId });
    });

    it('loads a fiddle with a custom editor', async () => {
      const filename = 'file.js';
      const content = '// hello!';
      const gistId = 'customtestid';

      store.gistId = gistId;

      editorValues[filename] = content;
      mockGistFiles[filename] = { content };
      mockRepos.push({
        name: filename,
        download_url: `https://${filename}`,
      });

      (getOctokit as jest.Mock).mockReturnValue({ gists: mockGetGists });
      instance.verifyAddEditor = jest.fn().mockResolvedValue(true);

      const result = await instance.fetchGistAndLoad(gistId);

      expect(result).toBe(true);
      expect(app.replaceFiddle).toBeCalledWith(editorValues, { gistId });
    });

    it('handles an error', async () => {
      (getOctokit as jest.Mock).mockReturnValue({
        gists: {
          get: async () => {
            throw new Error('Bwap bwap');
          },
        },
      });

      const result = await instance.fetchGistAndLoad('abcdtestid');
      expect(result).toBe(false);
    });
  });

  describe('fetchExampleAndLoad()', () => {
    beforeEach(() => {
      instance.setElectronVersionWithRef = jest.fn().mockReturnValueOnce(true);
      Object.keys(mockGistFiles).forEach(mockFetchOnce);
    });

    it('loads an Electron example', async () => {
      (getOctokit as jest.Mock).mockReturnValue({ repos: mockGetRepos });

      await instance.fetchExampleAndLoad('4.0.0', 'test/path');

      const expectedValues = {};
      for (const filename of Object.keys(mockGistFiles)) {
        expectedValues[filename] = filename;
      }
      expect(app.replaceFiddle).toHaveBeenCalledTimes(1);
      expect(app.replaceFiddle).toHaveBeenCalledWith(expectedValues, {
        gistId: '',
      });
    });

    it('handles an error', async () => {
      (getOctokit as jest.Mock).mockReturnValue({
        repos: {
          getContents: async () => {
            throw new Error('Bwap bwap');
          },
        },
      });

      const result = await instance.fetchExampleAndLoad('4.0.0', 'test/path');
      expect(result).toBe(false);
    });

    it('handles incorrect results', async () => {
      (getOctokit as jest.Mock).mockReturnValue({
        repos: {
          getContents: async () => ({
            not_an_array: true,
          }),
        },
      });

      const result = await instance.fetchExampleAndLoad('4.0.0', 'test/path');
      expect(result).toBe(false);
      expect(store.setGenericDialogOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          label: expect.stringMatching('invalid Fiddle'),
        }),
      );
    });
  });

  describe('setElectronVersionFromRef()', () => {
    it('sets version from ref if release channel enabled', async () => {
      instance.getPackageVersionFromRef = jest
        .fn()
        .mockReturnValueOnce('4.0.0');

      const result = await instance.setElectronVersionWithRef('4.0.0');
      expect(result).toBe(true);
      expect(store.setVersion).toBeCalledWith('4.0.0');
    });

    it('enables release channel when authorized', async () => {
      instance.getPackageVersionFromRef = jest
        .fn()
        .mockReturnValueOnce('4.0.0-beta');
      instance.verifyReleaseChannelEnabled = jest.fn().mockReturnValue(true);

      const result = await instance.setElectronVersionWithRef('4.0.0-beta');
      expect(result).toBe(true);
      expect(store.channelsToShow).toContain(ElectronReleaseChannel.beta);
    });

    it('does not load unsupported versions of Fiddle', async () => {
      instance.getPackageVersionFromRef = jest
        .fn()
        .mockReturnValueOnce('5.0.0');

      const result = await instance.setElectronVersionWithRef('5.0.0');
      expect(result).toBe(false);
      expect(store.setGenericDialogOptions).toBeCalledWith({
        type: GenericDialogType.warning,
        label:
          'Loading the fiddle failed: Error: Version of Electron in example not supported',
        cancel: undefined,
      });
    });
  });

  describe('getPackageFromRef()', () => {
    it('gets electron version from package.json', async () => {
      const versionString = JSON.stringify({ version: '4.0.0' });
      const content = Buffer.from(versionString).toString('base64');
      const mockGetPackageJson = {
        getContents: async () => ({
          data: { content },
        }),
      };

      (getOctokit as jest.Mock).mockReturnValue({ repos: mockGetPackageJson });

      const result = await instance.getPackageVersionFromRef('4.0.0');
      expect(result).toBe('4.0.0');
    });
  });

  describe('verifyRemoteLoad()', () => {
    it('asks the user if they want to load remote content', (done) => {
      instance.verifyRemoteLoad('test').then(done);
      expect(store.isGenericDialogShowing).toBe(true);
      store.isGenericDialogShowing = false;
    });
  });

  describe('verifyReleaseChannelEnabled', () => {
    it('asks the user if they want to enable a release channel', (done) => {
      instance
        .verifyReleaseChannelEnabled(ElectronReleaseChannel.beta)
        .then(done);
      expect(store.isGenericDialogShowing).toBe(true);
      store.isGenericDialogShowing = false;
    });
  });

  describe('loadFiddleFromElectronExample()', () => {
    it('loads the example with confirmation', async () => {
      instance.verifyRemoteLoad = jest.fn().mockReturnValue(true);
      instance.verifyReleaseChannelEnabled = jest.fn().mockReturnValue(true);
      instance.fetchExampleAndLoad = jest.fn();
      await instance.loadFiddleFromElectronExample(
        {},
        { path: 'test/path', ref: '4.0.0' },
      );

      expect(instance.verifyRemoteLoad).toHaveBeenCalledWith<any>(
        `'test/path' example from the Electron docs for version 4.0.0`,
      );
      expect(instance.fetchExampleAndLoad).toHaveBeenCalledWith<any>(
        '4.0.0',
        'test/path',
      );
    });

    it('does not load the example without confirmation', async () => {
      instance.verifyRemoteLoad = jest.fn().mockReturnValue(false);
      instance.verifyReleaseChannelEnabled = jest.fn();
      instance.fetchExampleAndLoad = jest.fn();
      await instance.loadFiddleFromElectronExample(
        {},
        { path: 'test/path', ref: '4.0.0' },
      );

      expect(instance.verifyRemoteLoad).toHaveBeenCalled();
      expect(instance.fetchExampleAndLoad).toHaveBeenCalledTimes(0);
    });
  });

  describe('loadFiddleFromGist()', () => {
    it('loads the example with confirmation', async () => {
      instance.verifyRemoteLoad = jest.fn().mockReturnValue(true);
      instance.fetchGistAndLoad = jest.fn();
      await instance.loadFiddleFromGist({}, { id: 'gist' });

      expect(instance.verifyRemoteLoad).toHaveBeenCalledWith<any>('gist');
      expect(instance.fetchGistAndLoad).toHaveBeenCalledWith<any>('gist');
    });

    it('loads the example with confirmation', async () => {
      instance.verifyRemoteLoad = jest.fn().mockReturnValue(true);
      instance.fetchGistAndLoad = jest.fn();
      await instance.loadFiddleFromGist({}, { id: 'gist' });

      expect(instance.verifyRemoteLoad).toHaveBeenCalledWith<any>('gist');
      expect(instance.fetchGistAndLoad).toHaveBeenCalledWith<any>('gist');
    });

    it('does not load the example without confirmation', async () => {
      instance.verifyRemoteLoad = jest.fn().mockReturnValue(false);
      instance.fetchGistAndLoad = jest.fn();
      await instance.loadFiddleFromGist({}, { id: 'gist' });

      expect(instance.verifyRemoteLoad).toHaveBeenCalled();
      expect(instance.fetchGistAndLoad).toHaveBeenCalledTimes(0);
    });
  });
});
