import * as MonacoType from 'monaco-editor';

/**
 * Returns the currently focused editor.
 *
 * @returns {(MonacoType.editor.IStandaloneCodeEditor | null)}
 */
export function getFocusedEditor(
): MonacoType.editor.IStandaloneCodeEditor | null {
  const focusedKey = Object.keys(window.ElectronFiddle.editors).find((key) => {
    const editor: MonacoType.editor.IStandaloneCodeEditor
      = window.ElectronFiddle.editors[key];
    return editor && editor.hasTextFocus && editor.hasTextFocus();
  });

  return focusedKey
    ? window.ElectronFiddle.editors[focusedKey]
    : null;
}
