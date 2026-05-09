import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EditorValues,
  ElectronReleaseChannel,
  GistFile,
  GistRevision,
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
import { AppMock, StateMock, createEditorValues } from '../mocks/mocks';

type GistFiles = { [id: string]: GistFile };

describe('RemoteLoader', () => {
  let instance: RemoteLoader;
  let app: AppMock;
  let store: StateMock;
  let mockGistFiles: GistFiles;
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
        { filename: id, content: content as string },
      ]),
    );

    vi.mocked(window.ElectronFiddle.gistLoad).mockImplementation(async () => ({
      files: mockGistFiles,
      revision: 'sha1',
    }));
  });

  describe('fetchGistAndLoad()', () => {
    it('loads a fiddle', async () => {
      const gistId = 'abcdtestid';
      store.gistId = gistId;

      const result = await instance.fetchGistAndLoad(gistId);

      expect(result).toBe(true);
      expect(window.ElectronFiddle.gistLoad).toHaveBeenCalledWith({
        gistId,
        revision: undefined,
      });
      expect(app.replaceFiddle).toBeCalledWith(editorValues, { gistId });
    });

    it('handles bad JSON in package.json', async () => {
      const gistId = 'badjsontestid';
      const badPj =
        '{"main":"main.js","devDependencies":{"electron":"17.0.0",}}';

      store.gistId = gistId;
      mockGistFiles[PACKAGE_NAME] = { filename: PACKAGE_NAME, content: badPj };

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
      mockGistFiles[PACKAGE_NAME] = {
        filename: PACKAGE_NAME,
        content: JSON.stringify(pj, null, 2),
      };

      const result = await instance.fetchGistAndLoad(gistId);

      expect(result).toBe(true);
      expect(store.modules.size).toEqual(0);
    });

    it('throws an error when a user loads a gist with no supported files', async () => {
      const gistId = 'abcdtestid';

      store.showErrorDialog = vi.fn().mockResolvedValueOnce(true);
      vi.mocked(window.ElectronFiddle.gistLoad).mockResolvedValueOnce({
        files: {
          'blah.blah': { filename: 'blah.blah', content: '' },
          'yes.no': { filename: 'yes.no', content: '' },
        },
        revision: 'sha1',
      });
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
      mockGistFiles[PACKAGE_NAME] = {
        filename: PACKAGE_NAME,
        content: JSON.stringify(pj, null, 2),
      };

      vi.mocked(window.ElectronFiddle.isReleasedMajor).mockResolvedValue(true);

      const result = await instance.fetchGistAndLoad(gistId);

      expect(result).toBe(true);
      expect(store.modules.size).toEqual(0);
      expect(store.setVersion).toBeCalledWith('17.0.0');
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
      mockGistFiles[PACKAGE_NAME] = {
        filename: PACKAGE_NAME,
        content: JSON.stringify(pj, null, 2),
      };

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
      mockGistFiles[PACKAGE_NAME] = {
        filename: PACKAGE_NAME,
        content: JSON.stringify(pj, null, 2),
      };

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
      mockGistFiles[filename] = { filename, content };

      instance.confirmAddFile = vi.fn().mockResolvedValue(true);

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
      mockGistFiles[filename] = { filename, content };

      instance.confirmAddFile = vi.fn().mockResolvedValue(true);

      const result = await instance.fetchGistAndLoad(gistId);

      expect(result).toBe(true);
      expect(app.replaceFiddle).toBeCalledWith(editorValues, { gistId });
    });

    it('forwards the requested revision to the IPC', async () => {
      const gistId = 'abcdtestid';
      const revision = 'sha-revision';
      store.gistId = gistId;

      const result = await instance.fetchGistAndLoad(gistId, revision);

      expect(result).toBe(true);
      expect(window.ElectronFiddle.gistLoad).toHaveBeenCalledWith({
        gistId,
        revision,
      });
      expect(store.activeGistRevision).toBe(revision);
    });

    it('sets the active revision to the latest version when none is requested', async () => {
      const gistId = 'abcdtestid';
      store.gistId = gistId;

      const result = await instance.fetchGistAndLoad(gistId);

      expect(result).toBe(true);
      expect(store.activeGistRevision).toBe('sha1');
    });

    it('handles an error', async () => {
      vi.mocked(window.ElectronFiddle.gistLoad).mockRejectedValueOnce(
        new Error('Bwap bwap'),
      );

      const result = await instance.fetchGistAndLoad('abcdtestid');
      expect(result).toBe(false);
    });
  });

  describe('fetchExampleAndLoad()', () => {
    beforeEach(() => {
      instance.setElectronVersion = vi.fn().mockReturnValueOnce(true);
    });

    it('loads an Electron example', async () => {
      vi.mocked(window.ElectronFiddle.fetchExample).mockResolvedValue(
        editorValues,
      );

      await instance.fetchExampleAndLoad('v4.0.0', 'test/path');

      expect(window.ElectronFiddle.fetchExample).toHaveBeenCalledWith(
        'v4.0.0',
        'test/path',
      );
      expect(app.replaceFiddle).toHaveBeenCalledTimes(1);
      expect(app.replaceFiddle).toHaveBeenCalledWith(
        editorValues,
        expect.anything(),
      );
      expect(instance.setElectronVersion).toBeCalledWith('4.0.0');
    });

    it('handles an error from the IPC', async () => {
      vi.mocked(window.ElectronFiddle.fetchExample).mockRejectedValue(
        new Error('Bwap bwap'),
      );

      const result = await instance.fetchExampleAndLoad('v4.0.0', 'test/path');
      expect(result).toBe(false);
    });

    it('rejects an invalid Electron version in the tag', async () => {
      store.showErrorDialog = vi.fn().mockResolvedValueOnce(true);

      const result = await instance.fetchExampleAndLoad('not-a-tag', 'p');

      expect(result).toBe(false);
      expect(window.ElectronFiddle.fetchExample).not.toHaveBeenCalled();
      expect(store.showErrorDialog).toHaveBeenCalledWith(
        expect.stringMatching(/Could not determine Electron version/i),
      );
    });

    it('does not call fetchExample when setElectronVersion fails', async () => {
      instance.setElectronVersion = vi.fn().mockResolvedValueOnce(false);

      const result = await instance.fetchExampleAndLoad('v4.0.0', 'test/path');

      expect(result).toBe(false);
      expect(window.ElectronFiddle.fetchExample).not.toHaveBeenCalled();
    });
  });

  describe('setElectronVersion()', () => {
    it('sets version from ref if release channel enabled', async () => {
      store.showConfirmDialog = vi.fn().mockResolvedValueOnce(true);

      const result = await instance.setElectronVersion('4.0.0');
      expect(result).toBe(true);
      expect(store.setVersion).toBeCalledWith('4.0.0');
    });

    it('enables release channel when authorized', async () => {
      instance.verifyReleaseChannelEnabled = vi.fn().mockResolvedValue(true);

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
      store.showConfirmDialog = vi.fn().mockResolvedValueOnce(true);
      await instance.verifyReleaseChannelEnabled(ElectronReleaseChannel.beta);
      expect(store.showConfirmDialog).toHaveBeenCalledWith({
        label: expect.stringMatching(/enable the release channel/i),
        ok: 'Enable',
      });
    });
  });

  describe('loadFiddleFromElectronExample()', () => {
    it('loads the example with confirmation', async () => {
      store.showConfirmDialog = vi.fn().mockResolvedValueOnce(true);
      instance.verifyReleaseChannelEnabled = vi.fn().mockResolvedValue(true);
      instance.fetchExampleAndLoad = vi.fn();
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
      store.showConfirmDialog = vi.fn().mockResolvedValueOnce(false);
      instance.verifyReleaseChannelEnabled = vi.fn();
      instance.fetchExampleAndLoad = vi.fn();
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
      store.showConfirmDialog = vi.fn().mockResolvedValueOnce(true);
      instance.fetchGistAndLoad = vi.fn();
      await instance.loadFiddleFromGist({ id: 'gist' });

      expect(instance.fetchGistAndLoad).toHaveBeenCalledWith('gist');
      expect(store.showConfirmDialog).toHaveBeenCalledWith({
        label: expect.stringMatching(/are you sure/i),
        ok: 'Load',
      });
    });

    it('does not load the example without confirmation', async () => {
      store.showConfirmDialog = vi.fn().mockResolvedValueOnce(false);
      instance.fetchGistAndLoad = vi.fn();
      await instance.loadFiddleFromGist({ id: 'gist' });

      expect(instance.fetchGistAndLoad).not.toHaveBeenCalled();
      expect(store.showConfirmDialog).toHaveBeenCalled();
    });
  });

  describe('getGistRevisions()', () => {
    it('returns revisions from the IPC', async () => {
      const revisions: GistRevision[] = [
        {
          sha: 'sha1',
          date: '2026-02-01T10:00:00Z',
          title: 'Created',
          changes: { additions: 10, deletions: 0, total: 10 },
        },
        {
          sha: 'sha2',
          date: '2026-02-05T12:00:00Z',
          title: 'Revision 1',
          changes: { additions: 5, deletions: 2, total: 7 },
        },
      ];
      vi.mocked(window.ElectronFiddle.gistListCommits).mockResolvedValueOnce(
        revisions,
      );

      const result = await instance.getGistRevisions('test-gist-id');

      expect(window.ElectronFiddle.gistListCommits).toHaveBeenCalledWith(
        'test-gist-id',
      );
      expect(result).toEqual(revisions);
    });

    it('returns empty array on error', async () => {
      vi.mocked(window.ElectronFiddle.gistListCommits).mockRejectedValueOnce(
        new Error('API error'),
      );

      const revisions = await instance.getGistRevisions('test-gist-id');

      expect(revisions).toEqual([]);
    });
  });
});
