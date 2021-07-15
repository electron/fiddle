import { shallow } from 'enzyme';
import * as React from 'react';

import { DefaultEditorId } from '../../../src/interfaces';
import {
  MaximizeButton,
  RemoveButton,
} from '../../../src/renderer/components/editors-toolbar-button';

import { StateMock } from '../../mocks/mocks';

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
  let store: StateMock;

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

    ({ state: store } = (window as any).ElectronFiddle.app);
  });

  describe('MaximizeButton', () => {
    it('renders', () => {
      const wrapper = shallow(
        <MaximizeButton id={DefaultEditorId.main} appState={store as any} />,
        {
          context: mockContext,
        },
      );

      expect(wrapper).toMatchSnapshot();
    });

    it('handles a click', () => {
      const wrapper = shallow(
        <MaximizeButton id={DefaultEditorId.main} appState={store as any} />,
        {
          context: mockContext,
        },
      );

      wrapper.instance().context = mockContext;

      wrapper.dive().dive().find('button').simulate('click');
      expect(mockContext.mosaicActions.expand).toHaveBeenCalledTimes(1);
    });
  });

  describe('RemoveButton', () => {
    it('renders', () => {
      const wrapper = shallow(
        <RemoveButton id={DefaultEditorId.main} appState={store as any} />,
        {
          context: mockContext,
        },
      );
      expect(wrapper).toMatchSnapshot();
    });

    it('handles a click', () => {
      const hideSpy = jest.spyOn(store.editorMosaic, 'hide');

      const wrapper = shallow(
        <RemoveButton id={DefaultEditorId.main} appState={store as any} />,
        {
          context: mockContext,
        },
      );

      wrapper.dive().dive().find('button').simulate('click');
      expect(hideSpy).toHaveBeenCalledTimes(1);
    });
  });
});
