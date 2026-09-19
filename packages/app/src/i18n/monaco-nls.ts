// Monaco's `nls` bundles set globals Monaco reads while its modules load, so they
// must load first. A new language applies after a relaunch.
const BUNDLES = new Map<string, () => Promise<unknown>>([
  ['de', () => import('monaco-editor/nls/lang/de.js')],
  ['ja', () => import('monaco-editor/nls/lang/ja.js')],
]);

/** Loads Monaco's messages for the UI `locale`, when Monaco ships them. Call before Monaco is imported. */
export async function loadMonacoMessages(locale: string): Promise<void> {
  await BUNDLES.get(locale)?.();
}
