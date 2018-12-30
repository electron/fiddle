import { shallow } from 'enzyme';
import * as React from 'react';

import { Runner } from '../../../src/renderer/components/commands-runner';
import { ipcRendererManager } from '../../../src/renderer/ipc';
import { ElectronFiddleMock } from '../../mocks/electron-fiddle';
import { mockVersions } from '../../mocks/electron-versions';

jest.mock('../../../src/renderer/npm');
jest.mock('../../../src/renderer/file-manager');
jest.mock('fs-extra');
jest.mock('child_process');

describe('Runner component', () => {
  let store: any;

  beforeEach(() => {
    ipcRendererManager.removeAllListeners();

    store = {
      version: '2.0.2',
      versions: mockVersions,
      isRunning: false,
      get currentElectronVersion() {
        return mockVersions['2.0.2']
      }
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
});
