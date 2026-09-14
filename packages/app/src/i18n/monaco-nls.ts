/**
 * Monaco's own strings (REQUIREMENTS §9). Monaco ships German and Japanese
 * `nls` bundles that set globals Monaco reads while its modules load, so the
 * bundle must load before Monaco does. A new language applies after a
 * relaunch, which Settings offers.
 */
const BUNDLES = new Map<string, () => Promise<unknown>>([
  ['de', () => import('monaco-editor/nls/lang/de.js')],
  ['ja', () => import('monaco-editor/nls/lang/ja.js')],
]);

/** Loads Monaco's messages for the UI `locale`, when Monaco ships them. Call before Monaco is imported. */
export async function loadMonacoMessages(locale: string): Promise<void> {
  await BUNDLES.get(locale)?.();
}
