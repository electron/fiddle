/**
 * Attempts to update the layout of all editors. Exported as
 * a debounced version below.
 */
function _updateEditorLayout() {
  const { main, renderer, html } = window.ElectronFiddle.editors;

  if (main) main.layout();
  if (renderer) renderer.layout();
  if (html) html.layout();
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
