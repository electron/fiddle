import * as React from 'react';

import { InstallState } from '@vertedinde/fiddle-core';
import { shallow } from 'enzyme';

import { Runner } from '../../../src/renderer/components/commands-runner';
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
      store.currentElectronVersion.state = InstallState.installed;
      expectSnapshotToMatch();
    });

    it('running', () => {
      store.currentElectronVersion.state = InstallState.installed;
      store.isRunning = true;
      expectSnapshotToMatch();
    });

    it('installing modules', () => {
      store.currentElectronVersion.state = InstallState.installed;
      store.isInstallingModules = true;
      expectSnapshotToMatch();
    });

    it('InstallState.downloading', () => {
      store.currentElectronVersion.state = InstallState.downloading;
      store.currentElectronVersion.downloadProgress = 50;
      expectSnapshotToMatch();
    });

    it('InstallState.installing', () => {
      store.currentElectronVersion.state = InstallState.installing;
      expectSnapshotToMatch();
    });

    it('InstallState.installed', () => {
      store.currentElectronVersion.state = InstallState.installed;
      expectSnapshotToMatch();
    });

    it('InstallState.missing', () => {
      store.currentElectronVersion.state = InstallState.missing;
      expectSnapshotToMatch();
    });
  });
});
