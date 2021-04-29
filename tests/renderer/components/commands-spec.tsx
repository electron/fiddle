import * as React from 'react';
import { shallow } from 'enzyme';

import { Commands } from '../../../src/renderer/components/commands';

import { StateMock } from '../../mocks/mocks';

jest.mock('../../../src/renderer/components/commands-runner', () => ({
  Runner: 'runner',
}));

jest.mock('../../../src/renderer/components/commands-version-chooser', () => ({
  VersionChooser: 'version-chooser',
}));

jest.mock('../../../src/renderer/components/commands-address-bar', () => ({
  AddressBar: 'address-bar',
}));

jest.mock('../../../src/renderer/components/commands-action-button', () => ({
  GistActionButton: 'action-button',
}));

describe('Commands component', () => {
  let store: StateMock;

  beforeEach(() => {
    ({ state: store } = (window as any).ElectronFiddle.app);
  });

  it('renders', () => {
    const wrapper = shallow(<Commands appState={store as any} />);
    expect(wrapper).toMatchSnapshot();
  });
});
