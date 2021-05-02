import { EditorId } from '../interfaces';

import { waitFor } from './wait-for';

/**
 * Waits for editors to mount on a list of Mosaic IDs
 * @param editors
 */
export function waitForEditorsToMount(files: EditorId[]) {
  const { editorMosaic } = window.ElectronFiddle.app.state;
  const allMounted = () => files.every((id) => editorMosaic.editors.has(id));
  const opts = { timeout: 3000, interval: 100 };
  return waitFor(allMounted, opts).catch((error) => {
    throw `Can't mount editors onto mosaics. ${error.toString()}`;
  });
}
