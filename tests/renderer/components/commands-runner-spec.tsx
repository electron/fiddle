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

  it('renders default', () => {
    const wrapper = shallow(<Runner appState={store as any} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders running', () => {
    store.isRunning = true;
    const wrapper = shallow(<Runner appState={store as any} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders downloading', () => {
    store.versions['2.0.2'].state = VersionState.downloading;
    const wrapper = shallow(<Runner appState={store as any} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders "checking status"', () => {
    store.versions['2.0.2'].state = VersionState.unknown;
    const wrapper = shallow(<Runner appState={store as any} />);
    expect(wrapper).toMatchSnapshot();
  });
});
