import { DefaultEditorId, EditorValues } from '../../src/interfaces';

export function createEditorValues(): EditorValues {
  return {
    [DefaultEditorId.main]: '// main.js',
    [DefaultEditorId.renderer]: '// renderer.js',
    [DefaultEditorId.preload]: '// preload.js',
    [DefaultEditorId.html]: '<!-- index.html -->',
    [DefaultEditorId.css]: '/* style.css */',
  };
}
