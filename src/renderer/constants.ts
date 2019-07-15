import { remote } from 'electron';
import * as path from 'path';
import { MosaicNode } from 'react-mosaic-component';

import { EditorId, MosaicId } from '../interfaces';

// Reminder: When testing, this file is mocked in tests/setup.js

export const USER_DATA_PATH = remote.app.getPath('userData');
export const CONFIG_PATH = path.join(remote.app.getPath('home'), '.electron-fiddle');

export const DEFAULT_MOSAIC_ARRANGEMENT: MosaicNode<MosaicId> = {
  direction: 'row',
  first: EditorId.main,
  second: {
    direction: 'column',
    first: EditorId.renderer,
    second: EditorId.html,
  }
};

export const ELECTRON_ORG = 'electron';
export const ELECTRON_REPO = 'electron';
