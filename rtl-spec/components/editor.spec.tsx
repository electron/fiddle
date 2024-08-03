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

  function createEditor(id: EditorId, didMount: DidMount = jest.fn()) {
    return renderClassComponentWithInstanceRef(Editor, {
      appState: store,
      editorDidMount: didMount,
      id,
      monaco,
      monacoOptions: {},
      setFocused: () => undefined,
    });
  }

  function initializeEditorMosaic(id: EditorId) {
    store.editorMosaic.set({ [id]: '// content' });
  }

  it('renders the editor container', () => {
    const id = MAIN_JS;
    initializeEditorMosaic(id);

    const { renderResult } = createEditor(id);

    expect(renderResult.getByTestId('editorContainer')).toBeInTheDocument();
  });

  describe('correctly sets the language', () => {
    it.each([
      ['for javascript', 'file.js', 'javascript'],
      ['for html', 'file.html', 'html'],
      ['for css', 'file.css', 'css'],
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
      editorMosaic.set({ [id]: '// content' });
      const addEditorSpy = jest.spyOn(editorMosaic, 'addEditor');

      const didMount = jest.fn();
      createEditor(id, didMount);

      expect(didMount).toHaveBeenCalled();
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
