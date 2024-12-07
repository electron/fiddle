import { userEvent } from '@testing-library/user-event';
import { MosaicContext, MosaicWindowContext } from 'react-mosaic-component';

import { EditorId, MAIN_JS } from '../../src/interfaces';
import {
  MaximizeButton,
  RemoveButton,
} from '../../src/renderer/components/editors-toolbar-button';
import { AppState } from '../../src/renderer/state';
import { renderClassComponentWithInstanceRef } from '../test-utils/renderClassComponentWithInstanceRef';

let mockContext = {} as MosaicWindowContext & MosaicContext<string>;

jest.mock('react-mosaic-component', () => {
  const { MosaicContext, MosaicRootActions, MosaicWindowContext } =
    jest.requireActual('react-mosaic-component');

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

    ({ state: store } = window.app);
  });

  describe('MaximizeButton', () => {
    function createMaximizeButton(id: EditorId) {
      return renderClassComponentWithInstanceRef(MaximizeButton, {
        id,
        appState: store,
      });
    }

    it('renders', () => {
      const { renderResult } = createMaximizeButton(MAIN_JS);
      expect(renderResult.getByRole('button')).toBeInTheDocument();
    });

    it('handles a click', async () => {
      const { instance, renderResult } = createMaximizeButton(MAIN_JS);
      instance.context = mockContext;
      await userEvent.click(renderResult.getByRole('button'));
      expect(mockContext.mosaicActions.expand).toHaveBeenCalledTimes(1);
    });
  });

  describe('RemoveButton', () => {
    function createRemoveButton(id: EditorId) {
      return renderClassComponentWithInstanceRef(RemoveButton, {
        id,
        appState: store,
      });
    }

    it('renders', () => {
      const { renderResult } = createRemoveButton(MAIN_JS);
      expect(renderResult.getByRole('button')).toBeInTheDocument();
    });

    it('handles a click', async () => {
      const { editorMosaic } = store;
      const hideSpy = jest.spyOn(editorMosaic, 'hide');
      const { renderResult } = createRemoveButton(MAIN_JS);
      await userEvent.click(renderResult.getByRole('button'));
      expect(hideSpy).toHaveBeenCalledTimes(1);
    });
  });
});
