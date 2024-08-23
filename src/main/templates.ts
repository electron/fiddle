import * as path from 'node:path';

import { IpcMainEvent } from 'electron';

import { STATIC_DIR } from './constants';
import { ipcMainManager } from './ipc';
import { readFiddle } from './utils/read-fiddle';
import { EditorValues } from '../interfaces';
import { IpcEvents } from '../ipc-events';

/**
 * Returns expected content for a given name.
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
