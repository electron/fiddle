import {
  DefaultEditorId,
  ElectronReleaseChannel,
  VersionSource,
  VersionState,
} from '../../src/interfaces';
import { ipcRendererManager } from '../../src/renderer/ipc';
import { RemoteLoader } from '../../src/renderer/remote-loader';
import { getOctokit } from '../../src/utils/octokit';
import { AppMock, StateMock } from '../mocks/mocks';
import { FetchMock } from '../utils';

jest.mock('../../src/utils/octokit');

const mockGistFiles = {
  [DefaultEditorId.renderer]: {
    content: 'renderer-content',
  },
  [DefaultEditorId.main]: {
    content: 'main-content',
  },
  [DefaultEditorId.html]: {
    content: 'html',
  },
  [DefaultEditorId.preload]: {
    content: 'preload',
  },
  [DefaultEditorId.css]: {
    content: 'css',
  },
};

const mockGetGists = {
  get: async () => ({
    data: {
      files: mockGistFiles,
    },
  }),
};

const mockRepos = [
  {
    name: DefaultEditorId.main,
    download_url: 'https://main',
  },
  {
    name: DefaultEditorId.renderer,
    download_url: 'https://renderer',
  },
  {
    name: DefaultEditorId.html,
    download_url: 'https://html',
  },
  {
    name: DefaultEditorId.css,
    download_url: 'https://css',
  },
  {
    name: DefaultEditorId.preload,
    download_url: 'https://preload',
  },
  {
    name: 'other_stuff',
    download_url: 'https://google.com',
  },
];

const mockGetRepos = {
  getContents: async () => ({
    data: mockRepos,
  }),
};

describe('RemoteLoader', () => {
  let instance: RemoteLoader;
  let app: AppMock;
  let store: StateMock;

  beforeEach(() => {
    ({ app } = (window as any).ElectronFiddle);
    ({ state: store } = app);
    ipcRendererManager.send = jest.fn();
    store.channelsToShow = [ElectronReleaseChannel.stable];
    store.initVersions('4.0.0', {
      '4.0.0': { version: '4.0.0' },
      '4.0.0-beta': { version: '4.0.0-beta' },
    } as any);
    instance = new RemoteLoader(store as any);
  });

  afterEach(() => {
    ipcRendererManager.removeAllListeners();
  });

  describe('fetchGistAndLoad()', () => {
    it('loads a fiddle', async () => {
      (getOctokit as jest.Mock).mockReturnValue({ gists: mockGetGists });
      store.gistId = 'abcdtestid';

      const result = await instance.fetchGistAndLoad('abcdtestid');

      expect(result).toBe(true);
      expect(app.replaceFiddle).toBeCalledWith(
        {
          [DefaultEditorId.html]: mockGistFiles[DefaultEditorId.html].content,
          [DefaultEditorId.main]: mockGistFiles[DefaultEditorId.main].content,
          [DefaultEditorId.renderer]:
            mockGistFiles[DefaultEditorId.renderer].content,
          [DefaultEditorId.preload]:
            mockGistFiles[DefaultEditorId.preload].content,
          [DefaultEditorId.css]: mockGistFiles[DefaultEditorId.css].content,
        },
        { gistId: 'abcdtestid' },
      );
    });

    it('loads a fiddle with a custom editor', async () => {
      store.gistId = 'customtestid';

      const file = 'file.js';
      mockGistFiles[file] = { content: 'hello' };
      mockRepos.push({
        name: file,
        download_url: 'https://file',
      });

      (getOctokit as jest.Mock).mockReturnValue({ gists: mockGetGists });
      instance.verifyCreateCustomEditor = jest.fn().mockResolvedValue(true);

      const result = await instance.fetchGistAndLoad('customtestid');

      expect(result).toBe(true);
      expect(app.replaceFiddle).toBeCalledWith(
        {
          [DefaultEditorId.html]: mockGistFiles[DefaultEditorId.html].content,
          [DefaultEditorId.main]: mockGistFiles[DefaultEditorId.main].content,
          [DefaultEditorId.renderer]:
            mockGistFiles[DefaultEditorId.renderer].content,
          [DefaultEditorId.preload]:
            mockGistFiles[DefaultEditorId.preload].content,
          [DefaultEditorId.css]: mockGistFiles[DefaultEditorId.css].content,
          [file]: mockGistFiles[file].content,
        },
        { gistId: 'customtestid' },
      );
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
    let fetchMock: FetchMock;

    beforeEach(() => {
      instance.setElectronVersionWithRef = jest.fn().mockReturnValueOnce(true);
      fetchMock = new FetchMock();
      for (const { name, download_url } of mockRepos) {
        fetchMock.add(download_url, name);
      }
    });

    it('loads an Electron example', async () => {
      (getOctokit as jest.Mock).mockResolvedValue({ repos: mockGetRepos });

      await instance.fetchExampleAndLoad('4.0.0', 'test/path');

      expect(app.replaceFiddle).toHaveBeenCalledWith(
        expect.objectContaining({
          [DefaultEditorId.html]: DefaultEditorId.html,
          [DefaultEditorId.main]: DefaultEditorId.main,
          [DefaultEditorId.renderer]: DefaultEditorId.renderer,
          [DefaultEditorId.css]: DefaultEditorId.css,
          [DefaultEditorId.preload]: DefaultEditorId.preload,
        }),
        expect.anything(),
      );
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
      expect(store.setGenericDialogOptions.mock.calls[0][0].label).toEqual(
        'Loading the fiddle failed: The example Fiddle tried to launch is not a valid Electron example',
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

    it('tries to download missing versions of Electron', async () => {
      const version = '5.0.0';
      instance.getPackageVersionFromRef = jest
        .fn()
        .mockReturnValueOnce(version);

      const result = await instance.setElectronVersionWithRef(version);
      expect(result).toBe(true);
      expect(store.addNewVersions).toBeCalledWith([
        {
          source: VersionSource.remote,
          state: VersionState.unknown,
          version,
        },
      ]);
      expect(store.setVersion).toBeCalledWith(version);
    });
  });

  describe('getPackageFromRef()', () => {
    it('gets Electron version from package.json', async () => {
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

    it('does not load the example without confirmation', async () => {
      instance.verifyRemoteLoad = jest.fn().mockReturnValue(false);
      instance.fetchGistAndLoad = jest.fn();
      await instance.loadFiddleFromGist({}, { id: 'gist' });

      expect(instance.verifyRemoteLoad).toHaveBeenCalled();
      expect(instance.fetchGistAndLoad).toHaveBeenCalledTimes(0);
    });
  });
});
