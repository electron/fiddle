export const enum ContentNames {
  HTML = 'html',
  RENDERER = 'renderer',
  MAIN = 'main'
}

/**
 * Returns expected content for a given name.
 *
 * @export
 * @param {ContentNames} name
 * @param {string} [version]
 * @returns {Promise<string>}
 */
export async function getContent(
  name: ContentNames,
  version?: string
): Promise<string> {
  if (name === ContentNames.HTML) {
    return (await import('../content/html')).html;
  }

  if (name === ContentNames.RENDERER) {
    return (await import('../content/renderer')).renderer;
  }

  if (name === ContentNames.MAIN) {
    // We currently only distinguish between loadFile
    // and loadURL. Todo: Properly version the quick-start.
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
 * @param {ContentNames} name
 * @returns {Promise<boolean>}
 */
export async function isContentUnchanged(name: ContentNames): Promise<boolean> {
  if (!window.ElectronFiddle || !window.ElectronFiddle.app) return false;

  const values = await window.ElectronFiddle.app.getValues({ include: false });

  // Handle main case, which needs to check both possible versions
  if (name === ContentNames.MAIN) {
    const isChanged1x = await getContent(ContentNames.MAIN, '1.0') === values.main;
    const isChangedOther = await getContent(ContentNames.MAIN) === values.main;

    return isChanged1x || isChangedOther;
  } else {
    return values[name] === await getContent(name);
  }
}
