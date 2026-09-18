/**
 * Windows jump list tasks start the app with one of these arguments, as a
 * second instance or at cold start. No Electron imports.
 */
import { findDeepLinkInArgv } from '../../fiddle/deep-link';

export const ARG_NEW_WINDOW = '--fiddle-new-window';
export const ARG_NEW_FIDDLE = '--fiddle-new-fiddle';
export const ARG_OPEN_FOLDER = '--fiddle-open-folder';

/**
 * The folder a jump list task asks to open. The jump list only offers recent
 * folders, so only one of `recent` is accepted. An `argv` that holds a deep
 * link is Documents' to handle, so a crafted link never acts as a task.
 */
export function jumpListFolder(
  argv: readonly string[],
  recent: readonly string[],
): string | undefined {
  if (findDeepLinkInArgv([...argv])) return undefined;
  const index = argv.indexOf(ARG_OPEN_FOLDER);
  const dir = index === -1 ? undefined : argv[index + 1];
  return dir !== undefined && recent.includes(dir) ? dir : undefined;
}
