import {
  DefaultEditorId,
  EditorValues,
  ElectronReleaseChannel,
  VersionSource,
  VersionState,
} from '../../src/interfaces';
import { ipcRendererManager } from '../../src/renderer/ipc';
import { RemoteLoader } from '../../src/renderer/remote-loader';
import { getOctokit } from '../../src/utils/octokit';
import { AppMock, StateMock, createEditorValues } from '../mocks/mocks';
import { FetchMock } from '../utils';

jest.mock('../../src/utils/octokit');

const editorValues: Readonly<EditorValues> = createEditorValues();

const mockGistFiles = Object.fromEntries(
  Object.entries(editorValues).map(([name, content]) => [
    name,
    { content: content as string },
  ]),
);

const mockRepos = Object.keys(editorValues).map((name) => ({
  name,
  download_url: `https://${name}`,
}));

const mockGetGists = {
  get: async () => ({
    data: {
      files: mockGistFiles,
    },
  }),
};

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
      const gistId = 'abcdtestid';
      store.gistId = gistId;

      const result = await instance.fetchGistAndLoad(gistId);

      expect(result).toBe(true);
      expect(app.replaceFiddle).toBeCalledWith(editorValues, { gistId });
    });

    it('loads a fiddle with a custom editor', async () => {
      const gistId = 'customtestid';
      store.gistId = gistId;

      const file = 'file.js';
      const content = '// hello';
      mockGistFiles[file] = { content };
      mockRepos.push({
        name: file,
        download_url: 'https://file',
      });

      (getOctokit as jest.Mock).mockReturnValue({ gists: mockGetGists });
      instance.verifyCreateCustomEditor = jest.fn().mockResolvedValue(true);

      const result = await instance.fetchGistAndLoad(gistId);

      expect(result).toBe(true);
      const expectedValues = { ...editorValues, [file]: content };
      expect(app.replaceFiddle).toBeCalledWith(expectedValues, { gistId });
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
      store.showErrorDialog = jest.fn().mockResolvedValueOnce(true);
      (getOctokit as jest.Mock).mockReturnValue({
        repos: {
          getContents: async () => ({
            not_an_array: true,
          }),
        },
      });

      const result = await instance.fetchExampleAndLoad('4.0.0', 'test/path');
      expect(result).toBe(false);
      expect(store.showErrorDialog).toHaveBeenCalledWith(
        expect.stringMatching(/not a valid/i),
      );
    });
  });

  describe('setElectronVersionFromRef()', () => {
    it('sets version from ref if release channel enabled', async () => {
      const version = '4.0.0';
      store.showConfirmDialog = jest.fn().mockResolvedValueOnce(true);
      instance.getPackageVersionFromRef = jest.fn().mockResolvedValue(version);

      const result = await instance.setElectronVersionWithRef(version);
      expect(result).toBe(true);
      expect(store.setVersion).toBeCalledWith(version);
    });

    it('enables release channel when authorized', async () => {
      const version = '4.0.0-beta';
      instance.getPackageVersionFromRef = jest.fn().mockResolvedValue(version);
      instance.verifyReleaseChannelEnabled = jest.fn().mockReturnValue(true);

      const result = await instance.setElectronVersionWithRef(version);
      expect(result).toBe(true);
      expect(store.channelsToShow).toContain(ElectronReleaseChannel.beta);
    });

    it('tries to download missing versions of Electron', async () => {
      const version = '5.0.0';
      instance.getPackageVersionFromRef = jest.fn().mockResolvedValue(version);

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
      const version = '4.0.0';
      const versionString = JSON.stringify({ version });
      const content = Buffer.from(versionString).toString('base64');
      const mockGetPackageJson = {
        getContents: async () => ({
          data: { content },
        }),
      };

      (getOctokit as jest.Mock).mockReturnValue({ repos: mockGetPackageJson });

      const result = await instance.getPackageVersionFromRef(version);
      expect(result).toBe(version);
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
      const version = '4.0.0';
      store.showConfirmDialog = jest.fn().mockResolvedValueOnce(true);
      instance.verifyReleaseChannelEnabled = jest.fn().mockReturnValue(true);
      instance.fetchExampleAndLoad = jest.fn();
      await instance.loadFiddleFromElectronExample(
        {},
        { path: 'test/path', ref: version },
      );

      expect(store.showConfirmDialog).toHaveBeenCalledWith({
        label: expect.stringMatching(version),
        ok: 'Load',
      });
      expect(instance.fetchExampleAndLoad).toHaveBeenCalledWith(
        version,
        'test/path',
      );
    });

    it('does not load the example without confirmation', async () => {
      store.showConfirmDialog = jest.fn().mockResolvedValueOnce(false);
      instance.verifyReleaseChannelEnabled = jest.fn();
      instance.fetchExampleAndLoad = jest.fn();
      await instance.loadFiddleFromElectronExample(
        {},
        { path: 'test/path', ref: '4.0.0' },
      );

      expect(store.showConfirmDialog).toHaveBeenCalled();
      expect(instance.fetchExampleAndLoad).toHaveBeenCalledTimes(0);
    });
  });

  describe('loadFiddleFromGist()', () => {
    it('loads the example with confirmation', async () => {
      store.showConfirmDialog = jest.fn().mockResolvedValueOnce(true);
      instance.fetchGistAndLoad = jest.fn();
      await instance.loadFiddleFromGist({}, { id: 'gist' });

      expect(instance.fetchGistAndLoad).toHaveBeenCalledWith('gist');
      expect(store.showConfirmDialog).toHaveBeenCalledWith({
        label: expect.stringMatching(/are you sure/i),
        ok: 'Load',
      });
    });

    it('does not load the example without confirmation', async () => {
      store.showConfirmDialog = jest.fn().mockResolvedValueOnce(false);
      instance.fetchGistAndLoad = jest.fn();
      await instance.loadFiddleFromGist({}, { id: 'gist' });

      expect(instance.fetchGistAndLoad).not.toHaveBeenCalled();
      expect(store.showConfirmDialog).toHaveBeenCalled();
    });
  });
});
