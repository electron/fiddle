import { MosaicId } from '../interfaces';

import { waitFor } from './wait-for';

/**
 * Waits for editors to mount on a list of Mosaic IDs
 * @param editors
 */
export function waitForEditorsToMount(editors: Array<MosaicId>) {
  const allMounted = () =>
    editors.every((id) => !!window.ElectronFiddle.editors[id]);
  const opts = { timeout: 3000, interval: 100 };
  return waitFor(allMounted, opts).catch((error) => {
    throw `Can't mount editors onto mosaics. ${error.toString()}`;
  });
}
