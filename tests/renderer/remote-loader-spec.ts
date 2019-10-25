import { observable } from 'mobx';
import { ipcRendererManager } from '../../src/renderer/ipc';
import { RemoteLoader } from '../../src/renderer/remote-loader';
import { ElectronReleaseChannel } from '../../src/renderer/versions';
import { INDEX_HTML_NAME, MAIN_JS_NAME, PRELOAD_JS_NAME, RENDERER_JS_NAME } from '../../src/shared-constants';
import { getOctokit } from '../../src/utils/octokit';
import { ElectronFiddleMock } from '../mocks/electron-fiddle';

jest.mock('../../src/utils/octokit');

const mockGistFiles = {
    [RENDERER_JS_NAME]: {
      content: 'renderer-content'
    },
    [MAIN_JS_NAME]: {
      content: 'main-content'
    },
    [INDEX_HTML_NAME]: {
      content: 'html'
    },
    [PRELOAD_JS_NAME]: {
      content: 'preload'
    }
};

const mockGetGists = {
  get: async () => ({
    data: {
      files: mockGistFiles
    }
  })
};

const mockRepos = [
  {
    name: MAIN_JS_NAME,
    download_url: 'https://main'
  }, {
    name: RENDERER_JS_NAME,
    download_url: 'https://renderer'
  }, {
    name: INDEX_HTML_NAME,
    download_url: 'https://html'
  }, {
    name: 'other_stuff',
    download_url: 'https://google.com'
  }
];

const mockGetRepos = {
  getContents: async () => ({
    data: mockRepos
  })
};

class MockStore {
  @observable public isWarningDialogShowing: boolean = false;
  @observable public isConfirmationPromptShowing: boolean = false;
  public setWarningDialogTexts = jest.fn();
  public toggleWarningDialog = jest.fn();
  public setConfirmationDialogTexts = jest.fn();
  public setConfirmationPromptTexts = jest.fn();
  public versions = {
    '4.0.0': {
      version: '4.0.0'
    },
    '4.0.0-beta': {
      version: '4.0.0-beta'
    }
  };
  public versionsToShow = [ElectronReleaseChannel.stable];
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
      expect(window.ElectronFiddle.app.replaceFiddle).toBeCalledWith({
        html: mockGistFiles[INDEX_HTML_NAME].content,
        main: mockGistFiles[MAIN_JS_NAME].content,
        renderer: mockGistFiles[RENDERER_JS_NAME].content,
        preload: mockGistFiles[PRELOAD_JS_NAME].content,
      }, {gistId: 'abcdtestid'});
    });

    it('handles an error', async () => {
      (getOctokit as jest.Mock).mockReturnValue({
        gists: {
          get: async () => {
            throw new Error('Bwap bwap');
          }
        }
      });

      const result = await instance.fetchGistAndLoad('abcdtestid');
      expect(result).toBe(false);
    });
  });

  describe('fetchExampleAndLoad()', () => {
    beforeEach(() => {
      instance.setElectronVersionWithRef = jest.fn().mockReturnValueOnce(true);
      // Setup the mock
      (fetch as any).mockResponses(
        [ 'main' ],
        [ 'renderer' ],
        [ 'index' ]
      );
    });

    it('loads an Electron example', async () => {
      (getOctokit as jest.Mock).mockReturnValue({ repos: mockGetRepos });

      await instance.fetchExampleAndLoad('4.0.0', 'test/path');

      const { calls } = (window.ElectronFiddle.app.replaceFiddle as jest.Mock).mock;

      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject(expect.arrayContaining([{
        html: 'index',
        main: 'main',
        renderer: 'renderer',
        preload: ''
      }]));
    });

    it('handles an error', async () => {
      (getOctokit as jest.Mock).mockReturnValue({
        repos: {
          getContents: async () => {
            throw new Error('Bwap bwap');
          }
        }
      });

      const result = await instance.fetchExampleAndLoad('4.0.0', 'test/path');
      expect(result).toBe(false);
    });

    it('handles incorrect results', async () => {
      (getOctokit as jest.Mock).mockReturnValue({
        repos: {
          getContents: async () => ({
            not_an_array: true
          })
        }
      });

      const result = await instance.fetchExampleAndLoad('4.0.0', 'test/path');
      expect(result).toBe(false);
      expect(store.setWarningDialogTexts.mock.calls[0][0].label).toEqual(
        'Loading the fiddle failed: Error: The example Fiddle tried to launch is not a valid Electron example'
      );
    });
  });

  describe('setElectronVersionFromRef()', () => {
    it('sets version from ref if release channel enabled', async () => {
      instance.getPackageVersionFromRef = jest.fn().mockReturnValueOnce('4.0.0');

      const result = await instance.setElectronVersionWithRef('4.0.0');
      expect(result).toBe(true);
      expect(store.setVersion).toBeCalledWith('4.0.0');
    });

    it('enables release channel when authorized', async () => {
      instance.getPackageVersionFromRef = jest.fn().mockReturnValueOnce('4.0.0-beta');
      instance.verifyReleaseChannelEnabled = jest.fn().mockReturnValue(true);

      const result = await instance.setElectronVersionWithRef('4.0.0-beta');
      expect(result).toBe(true);
      expect(store.versionsToShow).toContain(ElectronReleaseChannel.beta);
    });

    it('does not load unsupported versions of Fiddle', async () => {
      instance.getPackageVersionFromRef = jest.fn().mockReturnValueOnce('5.0.0');

      const result = await instance.setElectronVersionWithRef('5.0.0');
      expect(result).toBe(false);
      expect(store.setWarningDialogTexts).toBeCalledWith({
        label: 'Loading the fiddle failed: Error: Version of Electron in example not supported',
        cancel: undefined
      });
    });
  });

  describe('getPackageFromRef()', () => {
    it('gets electron version from package.json', async () => {
      const versionString = JSON.stringify({ version: '4.0.0' });
      const content = (Buffer.from(versionString)).toString('base64');
      const mockGetPackageJson = {
        getContents: async () => ({
          data: { content }
        })
      };

      (getOctokit as jest.Mock).mockReturnValue({ repos: mockGetPackageJson });

      const result = await instance.getPackageVersionFromRef('4.0.0');
      expect(result).toBe('4.0.0');
    });

  });

  describe('verifyRemoteLoad()', () => {
    it('asks the user if they want to load remote content', (done) => {
      instance.verifyRemoteLoad('test').then(done);
      expect(store.isConfirmationPromptShowing).toBe(true);
      store.isConfirmationPromptShowing = false;
    });
  });

  describe('verifyReleaseChannelEnabled', () => {
    it('asks the user if they want to enable a release channel', (done) => {
      instance.verifyReleaseChannelEnabled(ElectronReleaseChannel.beta).then(done);
      expect(store.isWarningDialogShowing).toBe(true);
      store.isWarningDialogShowing = false;
    });
  });

  describe('loadFiddleFromElectronExample()', () => {
    it('loads the example with confirmation', async () => {
      instance.verifyRemoteLoad = jest.fn().mockReturnValue(true);
      instance.verifyReleaseChannelEnabled = jest.fn().mockReturnValue(true);
      instance.fetchExampleAndLoad = jest.fn();
      await instance.loadFiddleFromElectronExample(
        {},
        { path: 'test/path', ref: '4.0.0' }
      );

      expect(instance.verifyRemoteLoad).toHaveBeenCalled();
      expect(instance.fetchExampleAndLoad).toHaveBeenCalledWith('4.0.0', 'test/path');
    });

    it('does not load the example without confirmation', async () => {
      instance.verifyRemoteLoad = jest.fn().mockReturnValue(false);
      instance.verifyReleaseChannelEnabled = jest.fn();
      instance.fetchExampleAndLoad = jest.fn();
      await instance.loadFiddleFromElectronExample(
        {},
        { path: 'test/path', ref: '4.0.0' }
      );

      expect(instance.verifyRemoteLoad).toHaveBeenCalled();
      expect(instance.fetchExampleAndLoad).toHaveBeenCalledTimes(0);
    });
  });

  describe('loadFiddleFromGist()', () => {
    it('loads the example with confirmation', async () => {
      instance.verifyRemoteLoad = jest.fn().mockReturnValue(true);
      instance.fetchGistAndLoad = jest.fn();
      await instance.loadFiddleFromGist(
        {},
        { id: 'gist' }
      );

      expect(instance.verifyRemoteLoad).toHaveBeenCalled();
      expect(instance.fetchGistAndLoad).toHaveBeenCalledWith('gist');
    });

    it('does not load the example without confirmation', async () => {
      instance.verifyRemoteLoad = jest.fn().mockReturnValue(false);
      instance.fetchGistAndLoad = jest.fn();
      await instance.loadFiddleFromGist(
        {},
        { id: 'gist' }
      );

      expect(instance.verifyRemoteLoad).toHaveBeenCalled();
      expect(instance.fetchGistAndLoad).toHaveBeenCalledTimes(0);
    });
  });
});
