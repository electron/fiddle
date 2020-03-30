import * as electron from 'electron';
import { mount } from 'enzyme';

import { renderMoreDocumentation } from '../../../../src/renderer/components/show-me/more-information';

describe('renderMoreDocumentation()', () => {
  it('renders', () => {
    const wrapper = mount(renderMoreDocumentation());
    expect(wrapper).toMatchSnapshot();

    wrapper.find('a#open-url').simulate('click');
    expect(electron.shell.openExternal).toHaveBeenCalledTimes(1);

    wrapper.find('a#open-github').simulate('click');
    expect(electron.shell.openExternal).toHaveBeenCalledTimes(2);
  });
});
