import * as path from 'path';
import { MosaicNode } from 'react-mosaic-component';

import { EditorId, MosaicId } from '../interfaces';
import { EditorBackup, getEditorBackup } from '../utils/editor-backup';

export const USER_DATA_PATH = window.ElectronFiddle.appPaths.userData;
export const CONFIG_PATH = path.join(
  window.ElectronFiddle.appPaths.home,
  '.electron-fiddle',
);

export const SORTED_EDITORS = Object.freeze([
  EditorId.main,
  EditorId.renderer,
  EditorId.html,
  EditorId.preload,
  EditorId.css,
]);

export const DEFAULT_MOSAIC_ARRANGEMENT: MosaicNode<MosaicId> = {
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

export const DEFAULT_CLOSED_PANELS: Partial<
  Record<MosaicId, EditorBackup | true>
> = {
  docsDemo: true,
  css: getEditorBackup(EditorId.css),
};

export const EMPTY_EDITOR_CONTENT = {
  html: '<!-- Empty -->',
  js: '// Empty',
  css: '/* Empty */',
};

export const ELECTRON_ORG = 'electron';
export const ELECTRON_REPO = 'electron';
