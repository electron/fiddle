import { mount } from 'enzyme';

import { renderNonIdealState } from '../../../src/renderer/components/editors-non-ideal-state';

describe('renderNonIdealState()', () => {
  it('renders a non-ideal state', () => {
    expect(renderNonIdealState({} as any)).toMatchSnapshot();
  });

  it('handles a click', () => {
    const mockState = { setVisibleMosaics: jest.fn() };
    const wrapper = mount(renderNonIdealState(mockState as any));
    wrapper.find('button').simulate('click');

    expect(mockState.setVisibleMosaics).toHaveBeenCalledTimes(1);
  });
});

