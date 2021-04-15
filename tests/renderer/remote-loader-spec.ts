import { observable } from 'mobx';
import {
  DefaultEditorId,
  ElectronReleaseChannel,
  GenericDialogType,
} from '../../src/interfaces';
import { ipcRendererManager } from '../../src/renderer/ipc';
import { RemoteLoader } from '../../src/renderer/remote-loader';
import { getOctokit } from '../../src/utils/octokit';
import { ElectronFiddleMock } from '../mocks/electron-fiddle';
import { mockFetchOnce } from '../utils';

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
  let instance: RemoteLoader;
  let store: any;

  beforeEach(() => {
    window.ElectronFiddle = new ElectronFiddleMock() as any;
    ipcRendererManager.send = jest.fn();

    store = new MockStore() as any;
    store.customMosaics = [];

    instance = new RemoteLoader(store);

    (global.fetch as jest.Mock).mockResolvedValue({
      text: () => Promise.resolve('hello'),
    });
  });

  afterEach(() => {
    ipcRendererManager.removeAllListeners();
  });

  describe('fetchGistAndLoad()', () => {
    it('loads a fiddle', async () => {
      const { app } = window.ElectronFiddle;
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
      const { app } = window.ElectronFiddle;

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
    beforeEach(() => {
      instance.setElectronVersionWithRef = jest.fn().mockReturnValueOnce(true);

      mockFetchOnce(DefaultEditorId.main);
      mockFetchOnce(DefaultEditorId.renderer);
      mockFetchOnce(DefaultEditorId.html);
      mockFetchOnce(DefaultEditorId.css);
      mockFetchOnce(DefaultEditorId.preload);
    });

    it('loads an Electron example', async () => {
      (getOctokit as jest.Mock).mockReturnValue({ repos: mockGetRepos });

      await instance.fetchExampleAndLoad('4.0.0', 'test/path');

      const { calls } = (window.ElectronFiddle.app
        .replaceFiddle as jest.Mock).mock;

      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject(
        expect.arrayContaining([
          expect.objectContaining({
            [DefaultEditorId.html]: DefaultEditorId.html,
            [DefaultEditorId.main]: DefaultEditorId.main,
            [DefaultEditorId.renderer]: DefaultEditorId.renderer,
            [DefaultEditorId.css]: DefaultEditorId.css,
            [DefaultEditorId.preload]: DefaultEditorId.preload,
          }),
        ]),
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
      expect(store.setGenericDialogOptions.mock.calls[0][0].label).toMatch(
        'Tried to launch an invalid Fiddle from',
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
