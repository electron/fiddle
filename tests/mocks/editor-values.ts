import { DefaultEditorId, EditorValues, MAIN_JS } from '../../src/interfaces';

export function createEditorValues(): EditorValues {
  return {
    [MAIN_JS]: '// main.js',
    [DefaultEditorId.renderer]: '// renderer.js',
    [DefaultEditorId.preload]: '// preload.js',
    [DefaultEditorId.html]: '<!-- index.html -->',
    [DefaultEditorId.css]: '/* style.css */',
  };
}
