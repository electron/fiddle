import { observable } from 'mobx';
import { GenericDialogType } from '../../src/interfaces';
import { ipcRendererManager } from '../../src/renderer/ipc';
import { RemoteLoader } from '../../src/renderer/remote-loader';
import { ElectronReleaseChannel } from '../../src/renderer/versions';
import {
  INDEX_HTML_NAME,
  MAIN_JS_NAME,
  PRELOAD_JS_NAME,
  RENDERER_JS_NAME,
  STYLES_CSS_NAME,
} from '../../src/shared-constants';
import { getOctokit } from '../../src/utils/octokit';
import { ElectronFiddleMock } from '../mocks/electron-fiddle';
import { mockFetchOnce } from '../utils';

jest.mock('../../src/utils/octokit');

const mockGistFiles = {
  [RENDERER_JS_NAME]: {
    content: 'renderer-content',
  },
  [MAIN_JS_NAME]: {
    content: 'main-content',
  },
  [INDEX_HTML_NAME]: {
    content: 'html',
  },
  [PRELOAD_JS_NAME]: {
    content: 'preload',
  },
  [STYLES_CSS_NAME]: {
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
    name: MAIN_JS_NAME,
    download_url: 'https://main',
  },
  {
    name: RENDERER_JS_NAME,
    download_url: 'https://renderer',
  },
  {
    name: INDEX_HTML_NAME,
    download_url: 'https://html',
  },
  {
    name: STYLES_CSS_NAME,
    download_url: 'https://css',
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
}

describe('RemoteLoader', () => {
  let instance: RemoteLoader;
  let store: any;

  beforeEach(() => {
    window.ElectronFiddle = new ElectronFiddleMock() as any;
    ipcRendererManager.send = jest.fn();

    store = new MockStore() as any;
    instance = new RemoteLoader(store);
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
      expect(window.ElectronFiddle.app.replaceFiddle).toBeCalledWith(
        {
          html: mockGistFiles[INDEX_HTML_NAME].content,
          main: mockGistFiles[MAIN_JS_NAME].content,
          renderer: mockGistFiles[RENDERER_JS_NAME].content,
          preload: mockGistFiles[PRELOAD_JS_NAME].content,
          css: mockGistFiles[STYLES_CSS_NAME].content,
        },
        { gistId: 'abcdtestid' },
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

      mockFetchOnce('main');
      mockFetchOnce('renderer');
      mockFetchOnce('index');
      mockFetchOnce('css');
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
            html: 'index',
            main: 'main',
            renderer: 'renderer',
            css: 'css',
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
      expect(store.setGenericDialogOptions.mock.calls[0][0].label).toEqual(
        'Loading the fiddle failed: Error: The example Fiddle tried to launch is not a valid Electron example',
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

    it('does not load the example without confirmation', async () => {
      instance.verifyRemoteLoad = jest.fn().mockReturnValue(false);
      instance.fetchGistAndLoad = jest.fn();
      await instance.loadFiddleFromGist({}, { id: 'gist' });

      expect(instance.verifyRemoteLoad).toHaveBeenCalled();
      expect(instance.fetchGistAndLoad).toHaveBeenCalledTimes(0);
    });
  });
});
