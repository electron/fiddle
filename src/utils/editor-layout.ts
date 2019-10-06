/**
 * Attempts to update the layout of all editors. Exported as
 * a debounced version below.
 */
function _updateEditorLayout() {
  Object.keys(window.ElectronFiddle.editors).forEach((key) => {
    if (window.ElectronFiddle.editors[key]) {
      window.ElectronFiddle.editors[key].layout();
    }
  });
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
