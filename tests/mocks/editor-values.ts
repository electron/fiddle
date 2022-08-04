import { EditorValues, MAIN_JS } from '../../src/interfaces';

export function createEditorValues(): EditorValues {
  return {
    [MAIN_JS]: '// main.js',
    'renderer.js': '// renderer.js',
    'preload.js': '// preload.js',
    'index.html': '<!-- index.html -->',
    'styles.css': '/* style.css */',
  };
}
