import { shallow } from 'enzyme';
import * as React from 'react';

import { VersionChooser } from '../../../src/renderer/components/version-chooser';
import { mockVersions } from '../../mocks/electron-versions';

describe('VersionChooser component', () => {
  beforeEach(() => {
    this.store = {
      versions: mockVersions,
      setVersion: jest.fn()
    };
  });

  it('renders', () => {
    const wrapper = shallow(<VersionChooser appState={this.store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('handles a change appropriately', () => {
    const wrapper = shallow(<VersionChooser appState={this.store} />);
    wrapper.find('select').simulate('change', { target: { value: 'v2.0.0' } });

    expect(this.store.setVersion).toHaveBeenCalledWith('v2.0.0');
  });
});
