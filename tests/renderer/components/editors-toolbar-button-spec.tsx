import * as React from 'react';

import { shallow } from 'enzyme';

import { EditorId, MAIN_JS } from '../../../src/interfaces';
import {
  MaximizeButton,
  RemoveButton,
} from '../../../src/renderer/components/editors-toolbar-button';
import { AppState } from '../../../src/renderer/state';

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
  };
});

describe('Editor toolbar button component', () => {
  let store: AppState;

  beforeAll(() => {
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

    ({ state: store } = window.ElectronFiddle.app);
  });

  describe('MaximizeButton', () => {
    function createMaximizeButton(id: EditorId) {
      const wrapper = shallow(<MaximizeButton id={id} appState={store} />, {
        context: mockContext,
      });
      const instance = wrapper.instance();
      return { instance, wrapper };
    }

    it('renders', () => {
      const { wrapper } = createMaximizeButton(MAIN_JS);
      expect(wrapper).toMatchSnapshot();
    });

    it('handles a click', () => {
      const { instance, wrapper } = createMaximizeButton(MAIN_JS);
      instance.context = mockContext as unknown;
      wrapper.dive().dive().find('button').simulate('click');
      expect(mockContext.mosaicActions.expand).toHaveBeenCalledTimes(1);
    });
  });

  describe('RemoveButton', () => {
    function createRemoveButton(id: EditorId) {
      const wrapper = shallow(<RemoveButton id={id} appState={store} />, {
        context: mockContext,
      });
      return { wrapper };
    }

    it('renders', () => {
      const { wrapper } = createRemoveButton(MAIN_JS);
      expect(wrapper).toMatchSnapshot();
    });

    it('handles a click', () => {
      const { editorMosaic } = store;
      const hideSpy = jest.spyOn(editorMosaic, 'hide');
      const { wrapper } = createRemoveButton(MAIN_JS);
      wrapper.dive().dive().find('button').simulate('click');
      expect(hideSpy).toHaveBeenCalledTimes(1);
    });
  });
});
