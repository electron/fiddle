import { shallow } from 'enzyme';
import * as React from 'react';

import { EditorId, MAIN_JS } from '../../../src/interfaces';
import { Editor } from '../../../src/renderer/components/editor';

import { StateMock } from '../../mocks/mocks';

type DidMount = () => void;

describe('Editor component', () => {
  let store: StateMock;
  let monaco: any;

  beforeEach(() => {
    ({ monaco } = window.ElectronFiddle);
    ({ state: store } = (window as any).ElectronFiddle.app);
  });

  function createEditor(id: EditorId, didMount: DidMount = jest.fn()) {
    const wrapper = shallow(
      <Editor
        appState={store as any}
        editorDidMount={didMount}
        id={id}
        monaco={monaco}
        monacoOptions={{}}
        setFocused={() => undefined}
      />,
    );
    const instance = wrapper.instance();
    return { wrapper, instance: instance as any };
  }

  it('renders the editor container', () => {
    const { wrapper } = createEditor(MAIN_JS);
    expect(wrapper.html()).toBe('<div class="editorContainer"></div>');
  });

  describe('correctly sets the language', () => {
    it.each([
      ['for javascript', 'file.js', 'javascript'],
      ['for html', 'file.html', 'html'],
      ['for css', 'file.css', 'css'],
    ])('%s', (_: unknown, filename: EditorId, language: string) => {
      const { instance } = createEditor(filename);
      expect(instance.language).toBe(language);
    });
  });

  it('denies updates', () => {
    const { instance } = createEditor(MAIN_JS);
    expect(instance.shouldComponentUpdate(null, null, null)).toBe(false);
  });

  describe('initMonaco()', async () => {
    it('calls editorMosaic.addEditor', async () => {
      const id = MAIN_JS;
      const { editorMosaic } = store;
      editorMosaic.set({ [id]: '// content' });
      const addEditorSpy = jest.spyOn(editorMosaic, 'addEditor');

      const didMount = jest.fn();
      const { instance } = createEditor(id, didMount);

      instance.containerRef.current = 'ref';
      await instance.initMonaco();

      expect(didMount).toHaveBeenCalled();
      expect(addEditorSpy).toHaveBeenCalledWith(id, expect.anything());
    });

    it('sets up a listener on focused text editor', async () => {
      const id = MAIN_JS;
      store.editorMosaic.set({ [id]: '// content' });
      const { instance } = createEditor(id);

      instance.containerRef.current = 'ref';
      await instance.initMonaco();
      expect(monaco.latestEditor.onDidFocusEditorText).toHaveBeenCalled();
    });
  });

  it('componentWillUnmount() attempts to dispose the editor', async () => {
    const id = MAIN_JS;
    store.editorMosaic.set({ [id]: '// content' });
    const didMount = jest.fn();
    const { instance } = createEditor(id, didMount);

    instance.containerRef.current = 'ref';
    await instance.initMonaco();
    instance.componentWillUnmount();

    expect(monaco.latestEditor.dispose).toHaveBeenCalled();
  });
});
