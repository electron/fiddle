import * as React from 'react';

import { shell } from 'electron';

/**
 * Renders a "more documentation" block, typically used at the end of a "show me" documentation piece.
 *
 * @export
 * @param {string} [url='electronjs.org/docs']
 * @returns {JSX.Element}
 */
export function renderMoreDocumentation(
  url: string = 'electronjs.org/docs'
): JSX.Element {
  const fullUrl = `https://${url}`;
  const gitHubUrl = `https://github.com/electron/fiddle`;

  return (
    <>
      <br />
      <p className='b3-running-text'>
        For more documentation, visit <a id='open-url' onClick={() => shell.openExternal(fullUrl)}>{url}</a>, where
        you can find the full documentation for Electron.
      </p>
      <p className='bp3-text-muted'>
        By the way, Electron Fiddle and the documentation you see here is entirely open source. If you
        have ideas on how to improve it, we'd love to have your contributions! You can find the
        repository on <a id='open-github' onClick={() => shell.openExternal(gitHubUrl)}>GitHub</a>.
      </p>
    </>
  );
}
