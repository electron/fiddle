import { throttle } from 'lodash';

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

export const updateEditorLayout = throttle(_updateEditorLayout, 400);
