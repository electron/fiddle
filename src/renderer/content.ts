export const enum ContentNames {
  HTML = 'html',
  RENDERER = 'renderer',
  MAIN = 'main'
}

/**
 * Returns expected content for a given name. Currently synchronous,
 * but probably shouldn't be.
 *
 * @param {string} name
 * @returns {string}
 */
export async function getContent(name: ContentNames): Promise<string> {
  if (name === ContentNames.HTML) {
    return (await import('../content/html')).html;
  }

  if (name === ContentNames.RENDERER) {
    return (await import('../content/renderer')).renderer;
  }

  if (name === ContentNames.MAIN) {
    return (await import('../content/main')).main;
  }

  return '';
}
