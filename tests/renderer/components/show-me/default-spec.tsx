import { mount } from 'enzyme';

import { DocsDemoPage } from '../../../../src/interfaces';
import { ShowMeDefault } from '../../../../src/renderer/components/show-me/default';

describe('getSubsetOnly()', () => {
  it('renders', () => {
    const mockState = { currentDocsDemoPage: undefined };
    const wrapper = mount(ShowMeDefault({ appState: mockState } as any));
    expect(wrapper).toMatchSnapshot();

    wrapper.find('button').simulate('click');

    expect(mockState.currentDocsDemoPage).toBe(DocsDemoPage.DEMO_APP);
  });
});
