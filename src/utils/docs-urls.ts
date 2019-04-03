/**
 * Get all the documentation urls for a given module name.
 *
 * @export
 * @param {string} moduleName
 */
export function getDocsUrlForModule(moduleName: string) {
  return {
    full: `https://electronjs.org/docs/api/${moduleName}`,
    repo: `https://github.com/electron/electron/blob/master/docs/api/${moduleName}.md`,
    short: `electronjs.org/docs/api/${moduleName}`
  };
}
