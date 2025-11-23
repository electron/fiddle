import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorId, MAIN_JS } from '../../src/interfaces';
import { Editor } from '../../src/renderer/components/editor';
import { AppState } from '../../src/renderer/state';
import { renderClassComponentWithInstanceRef } from '../test-utils/renderClassComponentWithInstanceRef';

type DidMount = () => void;

describe('Editor component', () => {
  let store: AppState;
  let monaco: any;

  beforeEach(() => {
    ({ monaco } = window);
    ({ state: store } = window.app);
  });

  function createEditor(id: EditorId, didMount: DidMount = vi.fn()) {
    return renderClassComponentWithInstanceRef(Editor, {
      appState: store,
      editorDidMount: didMount,
      id,
      monaco,
      monacoOptions: {},
      setFocused: () => undefined,
    });
  }

  async function initializeEditorMosaic(id: EditorId) {
    await store.editorMosaic.set({ [id]: '// content' });
  }

  it('renders the editor container', async () => {
    const id = MAIN_JS;
    await initializeEditorMosaic(id);

    const { renderResult } = createEditor(id);

    expect(renderResult.getByTestId('editorContainer')).toBeInTheDocument();
  });

  describe('correctly sets the language', () => {
    it.each([
      ['for javascript', 'file.js' as EditorId, 'javascript'],
      ['for html', 'file.html' as EditorId, 'html'],
      ['for css', 'file.css' as EditorId, 'css'],
    ])('%s', (_: unknown, filename: EditorId, language: string) => {
      initializeEditorMosaic(filename);

      const { instance } = createEditor(filename);

      expect(instance.language).toBe(language);
    });
  });

  it('denies updates', () => {
    const id = MAIN_JS;
    initializeEditorMosaic(id);

    const { instance } = createEditor(id);

    expect(instance.shouldComponentUpdate()).toBe(false);
  });

  describe('initMonaco()', () => {
    it('calls editorMosaic.addEditor', async () => {
      const id = MAIN_JS;
      const { editorMosaic } = store;
      await editorMosaic.set({ [id]: '// content' });
      const addEditorSpy = vi.spyOn(editorMosaic, 'addEditor');

      const didMount = vi.fn();
      createEditor(id, didMount);

      await vi.waitFor(() => didMount.mock.calls.length > 0);
      expect(addEditorSpy).toHaveBeenCalledWith(id, expect.anything());
    });

    it('sets up a listener on focused text editor', async () => {
      const id = MAIN_JS;
      initializeEditorMosaic(id);
      createEditor(id);

      expect(monaco.latestEditor.onDidFocusEditorText).toHaveBeenCalled();
    });
  });

  it('componentWillUnmount() attempts to dispose the editor', async () => {
    const id = MAIN_JS;
    initializeEditorMosaic(id);

    const {
      renderResult: { unmount },
    } = createEditor(id);

    unmount();

    expect(monaco.latestEditor.dispose).toHaveBeenCalled();
  });

  it('focus editor file', async () => {
    const id = MAIN_JS;
    initializeEditorMosaic(id);

    const {
      instance,
      renderResult: { unmount },
    } = createEditor(id);

    unmount();

    expect(instance.props.id).toBe(id);
  });
});
