import { remote } from 'electron';
import * as path from 'path';

export const USER_DATA_PATH = remote.app.getPath('userData');
export const CONFIG_PATH = path.join(remote.app.getPath('home'), '.electron-fiddle');
