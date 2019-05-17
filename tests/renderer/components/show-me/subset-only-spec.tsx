import * as electron from 'electron';
import { mount } from 'enzyme';

import { getSubsetOnly } from '../../../../src/renderer/components/show-me/subset-only';

describe('getSubsetOnly()', () => {
  it('renders', () => {
    const wrapper = mount(getSubsetOnly('app'));
    expect(wrapper).toMatchSnapshot();

    wrapper.find('a#open-url').simulate('click');
    expect(electron.shell.openExternal).toHaveBeenCalledTimes(1);
  });
});
