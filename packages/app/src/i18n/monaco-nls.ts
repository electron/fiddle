// Monaco's `nls` bundles set globals Monaco reads while its modules load, so they
// must load first. A new language applies after a relaunch.
const BUNDLES = new Map<string, () => Promise<unknown>>([
  ['de', () => import('monaco-editor/nls/lang/de.js')],
  ['es', () => import('monaco-editor/nls/lang/es.js')],
  ['fr', () => import('monaco-editor/nls/lang/fr.js')],
  ['ja', () => import('monaco-editor/nls/lang/ja.js')],
  ['ko', () => import('monaco-editor/nls/lang/ko.js')],
  ['pt-BR', () => import('monaco-editor/nls/lang/pt-br.js')],
  ['ru', () => import('monaco-editor/nls/lang/ru.js')],
  ['tr', () => import('monaco-editor/nls/lang/tr.js')],
  ['zh-CN', () => import('monaco-editor/nls/lang/zh-cn.js')],
  ['zh-TW', () => import('monaco-editor/nls/lang/zh-tw.js')],
]);

/** Loads Monaco's messages for the UI `locale`, when Monaco ships them. Call before Monaco is imported. */
export async function loadMonacoMessages(locale: string): Promise<void> {
  await BUNDLES.get(locale)?.();
}
