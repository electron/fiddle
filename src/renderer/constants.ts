import * as path from 'path';
import { MosaicNode } from 'react-mosaic-component';

import { DefaultEditorId, EditorId } from '../interfaces';

export const USER_DATA_PATH = window.ElectronFiddle.appPaths.userData;
export const CONFIG_PATH = path.join(
  window.ElectronFiddle.appPaths.home,
  '.electron-fiddle',
);

export const SORTED_EDITORS = Object.freeze([
  DefaultEditorId.main,
  DefaultEditorId.renderer,
  DefaultEditorId.html,
  DefaultEditorId.preload,
  DefaultEditorId.css,
]);

export const DEFAULT_MOSAIC_ARRANGEMENT: MosaicNode<EditorId> = {
  direction: 'row',
  first: {
    direction: 'column',
    first: SORTED_EDITORS[0],
    second: SORTED_EDITORS[1],
  },
  second: {
    direction: 'column',
    first: SORTED_EDITORS[2],
    second: SORTED_EDITORS[3],
  },
};

export const ELECTRON_ORG = 'electron';
export const ELECTRON_REPO = 'electron';
