import { throttle } from 'lodash';

function _updateEditorLayout() {
  const { main, renderer, html } = window.ElectronFiddle.editors;

  if (main) main.layout();
  if (renderer) renderer.layout();
  if (html) html.layout();
}

export const updateEditorLayout = throttle(_updateEditorLayout, 1000);
