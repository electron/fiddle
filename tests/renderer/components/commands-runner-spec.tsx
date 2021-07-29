import { shallow } from 'enzyme';
import * as React from 'react';

import { Runner } from '../../../src/renderer/components/commands-runner';
import { VersionState } from '../../../src/interfaces';
import { ipcRendererManager } from '../../../src/renderer/ipc';

import { StateMock } from '../../mocks/mocks';

jest.mock('../../../src/renderer/file-manager');
jest.mock('../../../src/renderer/npm');
jest.mock('child_process');
jest.mock('fs-extra');

describe('Runner component', () => {
  let store: StateMock;

  beforeEach(() => {
    ({ state: store } = (window as any).ElectronFiddle.app);
    ipcRendererManager.removeAllListeners();
  });

  describe('renders', () => {
    function expectSnapshotToMatch() {
      const wrapper = shallow(<Runner appState={store as any} />);
      expect(wrapper).toMatchSnapshot();
    }

    it('idle', () => {
      store.currentElectronVersion.state = VersionState.installed;
      expectSnapshotToMatch();
    });

    it('running', () => {
      store.currentElectronVersion.state = VersionState.installed;
      store.isRunning = true;
      expectSnapshotToMatch();
    });

    it('installing modules', () => {
      store.currentElectronVersion.state = VersionState.installed;
      store.isInstallingModules = true;
      expectSnapshotToMatch();
    });

    it('VersionState.downloading', () => {
      store.currentElectronVersion.state = VersionState.downloading;
      store.currentElectronVersion.downloadProgress = 50;
      expectSnapshotToMatch();
    });

    it('VersionState.installing', () => {
      store.currentElectronVersion.state = VersionState.installing;
      expectSnapshotToMatch();
    });

    it('VersionState.ready', () => {
      store.currentElectronVersion.state = VersionState.installed;
      expectSnapshotToMatch();
    });

    it('VersionState.not_downloaded', () => {
      store.currentElectronVersion.state = VersionState.not_downloaded;
      expectSnapshotToMatch();
    });
  });
});
