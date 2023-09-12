import * as React from 'react';

import { shallow } from 'enzyme';

import { InstallState } from '../../../src/interfaces';
import { Runner } from '../../../src/renderer/components/commands-runner';
import { AppState } from '../../../src/renderer/state';

jest.mock('../../../src/renderer/file-manager');

describe('Runner component', () => {
  let store: AppState;

  beforeEach(() => {
    ({ state: store } = window.app);
  });

  describe('renders', () => {
    function expectSnapshotToMatch() {
      const wrapper = shallow(<Runner appState={store} />);
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
