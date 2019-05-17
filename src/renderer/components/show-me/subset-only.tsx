import * as React from 'react';

import { shell } from 'electron';

import { getDocsUrlForModule } from '../../../utils/docs-urls';

/**
 * Returns a common string we use as a disclaimer to explain that this set of demos
 * is only meant to be a short demonstration, not displaying all of the modules
 * abilities.
 *
 * @export
 * @param {string} moduleName
 * @returns {JSX.Element}
 */
export function getSubsetOnly(moduleName: string): JSX.Element {
  const { full, short } = getDocsUrlForModule(moduleName);

  return (
    <p className='bp3-running-text'>
      The following demos display only a subset of what the <code>{moduleName}</code>
      module is capable of. If you want to see its full abilities, check out the
      documentation on <a id='open-url' onClick={() => shell.openExternal(full)}>{short}</a>.
    </p>
  );
}
