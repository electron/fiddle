import { shallow } from 'enzyme';
import * as React from 'react';

import { VersionState } from '../../../src/interfaces';
import { Runner } from '../../../src/renderer/components/commands-runner';
import { ipcRendererManager } from '../../../src/renderer/ipc';
import { ElectronFiddleMock } from '../../mocks/electron-fiddle';
import { MockVersions } from '../../mocks/electron-versions';

jest.mock('../../../src/renderer/npm');
jest.mock('../../../src/renderer/file-manager');
jest.mock('fs-extra');
jest.mock('child_process');

describe('Runner component', () => {
  let store: any;

  beforeEach(() => {
    const { mockVersions } = new MockVersions();

    ipcRendererManager.removeAllListeners();

    store = {
      version: '2.0.2',
      versions: mockVersions,
      isRunning: false,
      get currentElectronVersion() {
        return mockVersions[this.version];
      },
    };

    (window as any).ElectronFiddle = new ElectronFiddleMock();
  });

  it('renders default', () => {
    const wrapper = shallow(<Runner appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders running', () => {
    store.isRunning = true;
    const wrapper = shallow(<Runner appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders downloading', () => {
    store.versions['2.0.2'].state = VersionState.downloading;
    const wrapper = shallow(<Runner appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders "checking status"', () => {
    store.versions['2.0.2'].state = VersionState.unknown;
    const wrapper = shallow(<Runner appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });
});
