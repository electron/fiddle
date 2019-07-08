import { shallow } from 'enzyme';
import * as React from 'react';

import { EditorId } from '../../../src/interfaces';
import { MaximizeButton, RemoveButton } from '../../../src/renderer/components/editors-toolbar-button';

let mockContext: any = {};

jest.mock('react-mosaic-component', () => {
  const { MosaicContext, MosaicRootActions, MosaicWindowContext } = require.requireActual('react-mosaic-component');

  MosaicContext.Consumer = (props: any) => props.children(mockContext);

  return {
    MosaicContext,
    MosaicRootActions,
    MosaicWindowContext
  };
});

describe('Editor toolbar button component', () => {
  let store: any = {};

  beforeAll(() => {
    mockContext = {
      mosaicWindowActions: {
        getPath: jest.fn(),
        split: jest.fn(),
        replaceWithNew: jest.fn(),
        setAdditionalControlsOpen: jest.fn(),
        connectDragSource: jest.fn()
      },
      mosaicActions: {
        expand: jest.fn(),
        remove: jest.fn(),
        hide: jest.fn(),
        replaceWith: jest.fn(),
        updateTree: jest.fn(),
        getRoot: jest.fn()
      },
      mosaicId: 'test'
    };

    store = {
      hideAndBackupMosaic: jest.fn()
    };
  });

  describe('MaximizeButton', () => {
    it('renders', () => {
      const wrapper = shallow(<MaximizeButton id={EditorId.main} appState={store} />, {
        context: mockContext
      });

      expect(wrapper).toMatchSnapshot();
    });

    it('handles a click', () => {
      const wrapper = shallow(<MaximizeButton id={EditorId.main} appState={store} />, {
        context: mockContext
      });

      wrapper.instance().context = mockContext;

      wrapper.dive().dive().find('button').simulate('click');
      expect(mockContext.mosaicActions.expand).toHaveBeenCalledTimes(1);
    });
  });

  describe('RemoveButton', () => {
    it('renders', () => {
      const wrapper = shallow(<RemoveButton id={EditorId.main} appState={store} />, {
        context: mockContext
      });
      expect(wrapper).toMatchSnapshot();
    });

    it('handles a click', () => {
      const wrapper = shallow(<RemoveButton id={EditorId.main} appState={store} />, {
        context: mockContext
      });

      wrapper.dive().dive().find('button').simulate('click');
      expect(store.hideAndBackupMosaic).toHaveBeenCalledTimes(1);
    });
  });
});
