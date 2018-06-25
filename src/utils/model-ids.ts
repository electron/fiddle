import * as MonacoType from 'monaco-editor';

/**
 * Returns a model id that can be used to determine dirty state.
 *
 * @export
 * @returns {string}
 */
export function getCombinedModelId(): string {
  const { html, main, renderer } = window.ElectronFiddle.editors;
  const id = `${getModelId(html)}-${getModelId(main)}-${getModelId(renderer)}`;

  return id;
}

/**
 * Return the version id for a given editor's model. Used to determine
 * dirty state.
 *
 * @param {MonacoType.editor.IStandaloneCodeEditor | null} editor
 * @returns {number}
 */
function getModelId(
  editor: MonacoType.editor.IStandaloneCodeEditor | null
): number {
  if (!editor) return 0;
  return editor.getModel().getAlternativeVersionId();
}
