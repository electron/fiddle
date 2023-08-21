import { mocked } from 'jest-mock';

import {
  InstallState,
  NodeTypes,
  RunnableVersion,
  VersionSource,
} from '../../src/interfaces';
import { ElectronTypes } from '../../src/renderer/electron-types';
import { MonacoMock, NodeTypesMock } from '../mocks/mocks';
import { emitEvent, waitFor } from '../utils';

describe('ElectronTypes', () => {
  const version = '10.11.12';
  let addExtraLib: ReturnType<typeof jest.fn>;
  let localVersion: RunnableVersion;
  let monaco: MonacoMock;
  let remoteVersion: RunnableVersion;
  let electronTypes: ElectronTypes;
  let nodeTypesData: NodeTypesMock[];
  let disposable: { dispose: typeof jest.fn };

  beforeEach(() => {
    monaco = new MonacoMock();
    ({ addExtraLib } = monaco.languages.typescript.javascriptDefaults);
    disposable = { dispose: jest.fn() };
    addExtraLib.mockReturnValue(disposable);

    remoteVersion = {
      version,
      state: InstallState.installed,
      source: VersionSource.remote,
    } as const;

    localVersion = {
      version,
      localPath: '/foo/bar/',
      state: InstallState.installed,
      source: VersionSource.local,
    } as const;

    electronTypes = new ElectronTypes(monaco as any);
    nodeTypesData = require('../fixtures/node-types.json');
  });

  afterEach(async () => {
    await electronTypes.setVersion();
  });

  describe('setVersion({ source: local })', () => {
    const missingLocalVersion = {
      version,
      localPath: '/dev/null',
      state: InstallState.installed,
      source: VersionSource.local,
    } as const;

    it('gives types to monaco', async () => {
      const types = 'some types';
      mocked(window.ElectronFiddle.getElectronTypes).mockResolvedValue(types);
      await electronTypes.setVersion(localVersion);
      expect(addExtraLib).toHaveBeenCalledWith(types);
    });

    it('disposes the previous monaco content', async () => {
      // setup: call setVersion once to get some content into monaco
      const types = 'some types';
      mocked(window.ElectronFiddle.getElectronTypes).mockResolvedValue(types);
      await electronTypes.setVersion(localVersion);
      expect(addExtraLib).toHaveBeenCalledWith(types);
      expect(disposable.dispose).not.toHaveBeenCalled();

      // test: changing versions disposes the previous monaco content
      await electronTypes.setVersion(localVersion);
      expect(disposable.dispose).toHaveBeenCalledTimes(1);
    });

    it('watches for the types file to be updated', async () => {
      const oldTypes = 'some types';
      mocked(window.ElectronFiddle.getElectronTypes).mockResolvedValue(
        oldTypes,
      );
      await electronTypes.setVersion(localVersion);
      expect(addExtraLib).toHaveBeenCalledWith(oldTypes);

      expect(disposable.dispose).not.toHaveBeenCalled();
      const newTypes = 'some changed types';
      emitEvent('electron-types-changed', newTypes);
      expect(newTypes).not.toEqual(oldTypes);
      await waitFor(() => addExtraLib.mock.calls.length > 1);
      expect(addExtraLib).toHaveBeenCalledWith(newTypes);
      expect(disposable.dispose).toHaveBeenCalledTimes(1);
    });

    it('stops watching old types files when the version changes', async () => {
      // set to version A
      const types = 'some types';
      mocked(window.ElectronFiddle.getElectronTypes).mockResolvedValue(types);
      await electronTypes.setVersion(localVersion);
      expect(addExtraLib).toHaveBeenCalledWith(types);

      // now switch to version B
      await electronTypes.setVersion(missingLocalVersion);
      expect(addExtraLib).toHaveBeenCalled();

      // test that updating the now-unobserved version A triggers no actions
      addExtraLib.mockReset();
      try {
        await waitFor(() => addExtraLib.mock.calls.length > 0);
      } catch (err) {
        expect(err).toMatch(/timed out/i);
      }
      expect(addExtraLib).not.toHaveBeenCalled();
    });

    it('does not crash if the types file is missing', async () => {
      await electronTypes.setVersion(missingLocalVersion);
      expect(addExtraLib).not.toHaveBeenCalled();
    });
  });

  describe('setVersion({ source: remote })', () => {
    beforeEach(() => {
      addExtraLib.mockReturnValue({ dispose: jest.fn() });
    });

    it('gets types', async () => {
      const version = { ...remoteVersion, version: '15.0.0-nightly.20210628' };
      const types = 'here are the types';
      mocked(window.ElectronFiddle.getElectronTypes).mockResolvedValue(types);
      mocked(window.ElectronFiddle.getNodeTypes).mockResolvedValue({
        version: version.version,
        types: nodeTypesData
          .flatMap((entry) => (entry.files ? entry.files : entry))
          .filter(({ path }) => path.endsWith('.d.ts')) as unknown as NodeTypes,
      });

      await electronTypes.setVersion(version);

      expect(window.ElectronFiddle.getElectronTypes).toHaveBeenCalledWith(
        version,
      );
      expect(window.ElectronFiddle.getNodeTypes).toHaveBeenCalledWith(
        version.version,
      );

      expect(addExtraLib).toHaveBeenCalledTimes(52);
      expect(addExtraLib).toHaveBeenCalledWith(types);
    });

    it('does not crash if types are not found', async () => {
      mocked(window.ElectronFiddle.getNodeTypes).mockResolvedValue(undefined);
      await electronTypes.setVersion(remoteVersion);
      expect(window.ElectronFiddle.getNodeTypes).toHaveBeenCalledTimes(1);
      expect(addExtraLib).not.toHaveBeenCalled();
    });
  });

  describe('uncache()', () => {
    it('uncaches remote versions', async () => {
      await electronTypes.uncache(remoteVersion);
      expect(window.ElectronFiddle.uncacheTypes).toHaveBeenCalled();
    });

    it('does not uncache local versions', async () => {
      const version = { ...remoteVersion, source: VersionSource.local };
      await electronTypes.uncache(version);
      expect(window.ElectronFiddle.uncacheTypes).not.toHaveBeenCalled();
    });
  });
});
