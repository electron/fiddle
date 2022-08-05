import { mount } from 'enzyme';

import { renderNonIdealState } from '../../../src/renderer/components/editors-non-ideal-state';
import { EditorMosaic } from '../../../src/renderer/editor-mosaic';

describe('renderNonIdealState()', () => {
  let editorMosaic: EditorMosaic;

  beforeEach(() => {
    ({ editorMosaic } = (window as any).ElectronFiddle.app.state);
  });

  it('renders a non-ideal state', () => {
    expect(renderNonIdealState({} as any)).toMatchSnapshot();
  });

  it('handles a click', () => {
    const resetLayoutSpy = jest.spyOn(editorMosaic, 'resetLayout');
    const wrapper = mount(renderNonIdealState(editorMosaic as any));
    wrapper.find('button').simulate('click');
    expect(resetLayoutSpy).toHaveBeenCalledTimes(1);
  });
});
