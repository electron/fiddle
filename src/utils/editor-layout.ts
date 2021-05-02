/**
 * Attempts to update the layout of all editors. Exported as
 * a debounced version below.
 */
function _updateEditorLayout() {
  const { editorMosaic } = window.ElectronFiddle.app.state;
  editorMosaic.editors.forEach((editor) => editor.layout());
}

let handle: number;
export const updateEditorLayout = () => {
  if (!handle) {
    handle = window.setTimeout(() => {
      _updateEditorLayout();
      handle = 0;
    }, 100);
  }
};
