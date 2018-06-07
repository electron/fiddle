import { remote } from 'electron';

export const userData = remote.app.getPath('userData');
