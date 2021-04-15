import * as path from 'path';
import { MosaicNode } from 'react-mosaic-component';

import { DEFAULT_EDITORS, DefaultEditorId, EditorId } from '../interfaces';
import { EditorBackup, getEditorBackup } from '../utils/editor-backup';

export const USER_DATA_PATH = window.ElectronFiddle.appPaths.userData;
export const CONFIG_PATH = path.join(
  window.ElectronFiddle.appPaths.home,
  '.electron-fiddle',
);

export const DEFAULT_MOSAIC_ARRANGEMENT: MosaicNode<EditorId> = {
  direction: 'row',
  first: {
    direction: 'column',
    first: DEFAULT_EDITORS[0],
    second: DEFAULT_EDITORS[1],
  },
  second: {
    direction: 'column',
    first: DEFAULT_EDITORS[2],
    second: DEFAULT_EDITORS[3],
  },
} as const;

export const DEFAULT_CLOSED_PANELS: Partial<
  Record<EditorId, EditorBackup | true>
> = {
  'styles.css': getEditorBackup(DefaultEditorId.css),
} as const;

export const ELECTRON_ORG = 'electron';
export const ELECTRON_REPO = 'electron';
