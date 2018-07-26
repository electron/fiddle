import * as React from 'react';
import { shallow } from 'enzyme';

import { ChromeMac } from '../../../src/renderer/components/chrome-mac';
import { resetPlatform, overridePlatform } from '../../utils';

describe('Dialog component', () => {
  beforeEach(() => {
    this.store = {};
  });

  afterEach(() => resetPlatform());

  it('renders', () => {
    overridePlatform('darwin');

    const wrapper = shallow(<ChromeMac appState={this.store} />);
    expect(wrapper).toMatchSnapshot();
  });
});
