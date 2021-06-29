import { mount } from 'enzyme';

import { EditorMosaicMock } from '../../mocks/mocks';

import { renderNonIdealState } from '../../../src/renderer/components/editors-non-ideal-state';

describe('renderNonIdealState()', () => {
  let editorMosaic: EditorMosaicMock;

  beforeEach(() => {
    ({ editorMosaic } = (window as any).ElectronFiddle.app.state);
  });

  it('renders a non-ideal state', () => {
    expect(renderNonIdealState({} as any)).toMatchSnapshot();
  });

  it('handles a click', () => {
    const wrapper = mount(renderNonIdealState(editorMosaic as any));
    wrapper.find('button').simulate('click');

    expect(editorMosaic.resetLayout).toHaveBeenCalledTimes(1);
  });
});
