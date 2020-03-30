import { EditorId } from '../interfaces';

/**
 * Returns expected content for a given name.
 *
 * @export
 * @param {EditorId} name
 * @param {string} [version]
 * @returns {Promise<string>}
 */
export async function getContent(
  name: EditorId,
  version?: string,
): Promise<string> {
  if (name === EditorId.html) {
    return (await import('../content/html')).html;
  }

  if (name === EditorId.renderer) {
    return (await import('../content/renderer')).renderer;
  }

  if (name === EditorId.main) {
    // We currently only distinguish between loadFile
    // and loadURL. TODO: Properly version the quick-start.
    if (version && version.startsWith('1.')) {
      return (await import('../content/main-1-x-x')).main;
    }

    return (await import('../content/main')).main;
  }

  return '';
}

/**
 * Did the content change?
 *
 * @param {EditorId} name
 * @returns {Promise<boolean>}
 */
export async function isContentUnchanged(name: EditorId): Promise<boolean> {
  if (!window.ElectronFiddle || !window.ElectronFiddle.app) return false;

  const values = await window.ElectronFiddle.app.getEditorValues({ include: false });

  // Handle main case, which needs to check both possible versions
  if (name === EditorId.main) {
    const isChanged1x = await getContent(EditorId.main, '1.0') === values.main;
    const isChangedOther = await getContent(EditorId.main) === values.main;

    return isChanged1x || isChangedOther;
  } else {
    return values[name] === await getContent(name);
  }
}
