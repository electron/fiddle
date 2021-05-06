import { mount } from 'enzyme';

import { StateMock } from '../../mocks/mocks';

import { renderNonIdealState } from '../../../src/renderer/components/editors-non-ideal-state';

describe('renderNonIdealState()', () => {
  let state: StateMock;

  beforeEach(() => {
    ({ state } = (window as any).ElectronFiddle.app);
  });

  it('renders a non-ideal state', () => {
    expect(renderNonIdealState({} as any)).toMatchSnapshot();
  });

  it('handles a click', () => {
    const wrapper = mount(renderNonIdealState(state as any));
    wrapper.find('button').simulate('click');

    expect(state.editorMosaic.setVisibleMosaics).toHaveBeenCalledTimes(1);
  });
});
