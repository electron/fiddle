import { EditorMosaicMock } from '../../mocks/editor-mosaic';
import { mount } from 'enzyme';
import { renderNonIdealState } from '../../../src/renderer/components/editors-non-ideal-state';

describe('renderNonIdealState()', () => {
  it('renders a non-ideal state', () => {
    expect(renderNonIdealState({} as any)).toMatchSnapshot();
  });

  it('handles a click', () => {
    const editorMosaic = new EditorMosaicMock();
    const wrapper = mount(renderNonIdealState(editorMosaic as any));
    wrapper.find('button').simulate('click');

    expect(editorMosaic.showAll).toHaveBeenCalledTimes(1);
  });
});
