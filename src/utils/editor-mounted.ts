import { MosaicId } from '../interfaces';

/**
 * Waits for editors to mount on a list of Mosaic IDs
 * @param editors
 */
export function waitForEditorsToMount(editors: Array<MosaicId>) {
  let time = 0;
  const maxTime = 3000;
  const interval = 100;
  return new Promise<void>((resolve, reject) => {
    (function checkMountedEditors() {
      const allMounted = editors.every(
        (id) => !!window.ElectronFiddle.editors[id],
      );
      if (allMounted) {
        return resolve();
      }
      time += interval;
      if (time > maxTime) {
        return reject(
          `Timed out after ${maxTime}ms: can't mount editors onto mosaics.`,
        );
      }
      setTimeout(checkMountedEditors, 100);
    })();
  });
}
