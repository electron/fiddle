import * as path from 'path';
import { MosaicNode } from 'react-mosaic-component';

import { EditorId, MosaicId } from '../interfaces';
import { EditorBackup, getEditorBackup } from '../utils/editor-backup';

export const USER_DATA_PATH = window.ElectronFiddle.appPaths.userData;
export const CONFIG_PATH = path.join(
  window.ElectronFiddle.appPaths.home,
  '.electron-fiddle',
);

export const DEFAULT_MOSAIC_ARRANGEMENT: MosaicNode<MosaicId> = {
  direction: 'row',
  first: {
    direction: 'column',
    first: EditorId.main,
    second: EditorId.renderer,
  },
  second: {
    direction: 'column',
    first: EditorId.preload,
    second: EditorId.html,
  },
};

export const DEFAULT_CLOSED_PANELS: Partial<
  Record<MosaicId, EditorBackup | true>
> = {
  docsDemo: true,
  css: getEditorBackup(EditorId.css),
  test: getEditorBackup(EditorId.test)
};

export const EMPTY_EDITOR_CONTENT = {
  html: '<!-- Empty -->',
  js: '// Empty',
  css: '/* Empty */',
};

export const ELECTRON_ORG = 'electron';
export const ELECTRON_REPO = 'electron';
