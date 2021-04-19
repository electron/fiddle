import { EditorValues, MAIN_JS } from '../../src/interfaces';

export function createEditorValues(): EditorValues {
  return {
    'index.html': '<!-- index.html -->',
    'preload.js': '// preload.js',
    'renderer.js': '// renderer.js',
    [MAIN_JS]: '// main.js',
  };
}
