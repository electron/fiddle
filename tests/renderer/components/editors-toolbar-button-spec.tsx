import { shallow } from 'enzyme';
import * as React from 'react';

import { EditorId, EditorValues, MAIN_JS } from '../../../src/interfaces';
import { EditorMosaic, EditorState } from '../../../src/renderer/editor-mosaic';
import {
  MaximizeButton,
  RemoveButton,
} from '../../../src/renderer/components/editors-toolbar-button';

import { AppMock } from '../../mocks/app';
import { createEditorValues } from '../../mocks/editor-values';

let mockContext: any = {};

jest.mock('react-mosaic-component', () => {
  const {
    MosaicContext,
    MosaicRootActions,
    MosaicWindowContext,
  } = jest.requireActual('react-mosaic-component');

  MosaicContext.Consumer = (props: any) => props.children(mockContext);

  return {
    MosaicContext,
    MosaicRootActions,
    MosaicWindowContext,
    createBalancedTreeFromLeaves: jest.fn(),
  };
});

describe('Editor toolbar button component', () => {
  let app: AppMock;
  let editorValues: EditorValues;
  let editorMosaic: EditorMosaic;

  beforeAll(() => {
    app = new AppMock();
    editorMosaic = new EditorMosaic(app as any);

    editorValues = createEditorValues();
    editorMosaic.set(editorValues);

    mockContext = {
      mosaicWindowActions: {
        getPath: jest.fn(),
        split: jest.fn(),
        replaceWithNew: jest.fn(),
        setAdditionalControlsOpen: jest.fn(),
        connectDragSource: jest.fn(),
      },
      mosaicActions: {
        expand: jest.fn(),
        remove: jest.fn(),
        hide: jest.fn(),
        replaceWith: jest.fn(),
        updateTree: jest.fn(),
        getRoot: jest.fn(),
      },
      mosaicId: 'test',
    };
  });

  function createMaximizeButton(id: EditorId) {
    const wrapper = shallow(
      <MaximizeButton id={id} editorMosaic={editorMosaic} />,
      {
        context: mockContext,
      },
    );
    return { wrapper };
  }

  function createRemoveButton(id: EditorId) {
    const wrapper = shallow(
      <RemoveButton id={id} editorMosaic={editorMosaic} />,
      {
        context: mockContext,
      },
    );
    return { wrapper };
  }

  describe('MaximizeButton', () => {
    const filename = MAIN_JS;

    it('renders', () => {
      const { wrapper } = createMaximizeButton(filename);
      expect(wrapper).toMatchSnapshot();
    });

    it('handles a click', () => {
      const { wrapper } = createMaximizeButton(filename);
      wrapper.instance().context = mockContext;

      wrapper.dive().dive().find('button').simulate('click');
      expect(mockContext.mosaicActions.expand).toHaveBeenCalledTimes(1);
    });
  });

  describe('RemoveButton', () => {
    const filename = MAIN_JS;

    it('renders', () => {
      const { wrapper } = createRemoveButton(filename);
      expect(wrapper).toMatchSnapshot();
    });

    it('handles a click', () => {
      const { wrapper } = createRemoveButton(filename);
      wrapper.instance().context = mockContext;

      console.log(JSON.stringify(editorMosaic.inspect()));
      expect(editorMosaic.states.get(filename)).not.toBe(EditorState.Hidden);
      wrapper.dive().dive().find('button').simulate('click');
      console.log(JSON.stringify(editorMosaic.inspect()));
      expect(editorMosaic.states.get(filename)).toBe(EditorState.Hidden);
    });
  });
});
