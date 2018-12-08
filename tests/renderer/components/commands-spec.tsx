import { shallow } from 'enzyme';
import * as React from 'react';

import { Commands } from '../../../src/renderer/components/commands';

jest.mock('../../../src/renderer/components/commands-runner', () => ({
  Runner: 'runner'
}));

jest.mock('../../../src/renderer/components/commands-version-chooser', () => ({
  VersionChooser: 'version-chooser'
}));

jest.mock('../../../src/renderer/components/commands-address-bar', () => ({
  AddressBar: 'address-bar'
}));

jest.mock('../../../src/renderer/components/commands-publish-button', () => ({
  PublishButton: 'publish-button'
}));

describe('Commands component', () => {
  let store: any;

  beforeEach(() => {
    store = {
      gistId: null
    };
  });

  it('renders', () => {
    const wrapper = shallow(<Commands appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });
});
