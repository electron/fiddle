import * as path from 'path';

// eslint-disable-next-line import/no-unresolved
import { IpcMainEvent } from 'electron/main';

import { EditorValues } from '../interfaces';
import { IpcEvents } from '../ipc-events';
import { readFiddle } from '../utils/read-fiddle';
import { ipcMainManager } from './ipc';

const STATIC_DIR =
  process.env.NODE_ENV === 'production'
    ? path.join(__dirname, '../../static')
    : path.join(process.cwd(), './static');

/**
 * Returns expected content for a given name.
 *
 * @param {string} name
 * @returns {Promise<EditorValues>}
 */
export function getTemplateValues(name: string): Promise<EditorValues> {
  const templatePath = path.join(STATIC_DIR, 'show-me', name.toLowerCase());

  return readFiddle(templatePath);
}

export function setupTemplates() {
  ipcMainManager.handle(
    IpcEvents.GET_TEMPLATE_VALUES,
    (_: IpcMainEvent, name: string) => getTemplateValues(name),
  );
}
