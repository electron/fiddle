import { userEvent } from '@testing-library/user-event';
import { MosaicContext, MosaicWindowContext } from 'react-mosaic-component';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { EditorId, MAIN_JS } from '../../src/interfaces';
import {
  MaximizeButton,
  RemoveButton,
} from '../../src/renderer/components/editors-toolbar-button';
import { AppState } from '../../src/renderer/state';
import { renderClassComponentWithInstanceRef } from '../test-utils/renderClassComponentWithInstanceRef';

let mockContext = {} as MosaicWindowContext & MosaicContext<string>;

vi.mock('react-mosaic-component', async () => {
  const { MosaicContext, MosaicWindowContext } = await vi.importActual<
    typeof import('react-mosaic-component')
  >('react-mosaic-component');

  (MosaicContext.Consumer as any) = (props: any) => props.children(mockContext);

  return {
    MosaicContext,
    MosaicWindowContext,
  };
});

describe('Editor toolbar button component', () => {
  let store: AppState;

  beforeAll(() => {
    mockContext = {
      mosaicWindowActions: {
        getPath: vi.fn(),
        split: vi.fn(),
        replaceWithNew: vi.fn(),
        setAdditionalControlsOpen: vi.fn(),
        connectDragSource: vi.fn(),
      },
      mosaicActions: {
        expand: vi.fn(),
        remove: vi.fn(),
        hide: vi.fn(),
        replaceWith: vi.fn(),
        updateTree: vi.fn(),
        getRoot: vi.fn(),
      },
      mosaicId: 'test',
      blueprintNamespace: 'bp3',
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
      const hideSpy = vi.spyOn(editorMosaic, 'hide');
      const { renderResult } = createRemoveButton(MAIN_JS);
      await userEvent.click(renderResult.getByRole('button'));
      expect(hideSpy).toHaveBeenCalledTimes(1);
    });
  });
});
