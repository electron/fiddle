import * as React from 'react';
import { shallow } from 'enzyme';

import { ChromeMac } from '../../../src/renderer/components/chrome-mac';
import { resetPlatform, overridePlatform } from '../../utils';

describe('Chrome-Mac component', () => {
  beforeEach(() => {
    this.store = {};
  });

  afterEach(() => resetPlatform());

  it('renders', () => {
    overridePlatform('darwin');

    const wrapper = shallow(<ChromeMac appState={this.store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders nothing on win32', () => {
    overridePlatform('win32');

    const wrapper = shallow(<ChromeMac appState={this.store} />);
    expect(wrapper.html()).toBe(null);
  });
});
