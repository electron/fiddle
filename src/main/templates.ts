import * as path from 'node:path';

import { IpcMainInvokeEvent } from 'electron';

import { STATIC_DIR } from './constants';
import { ipcMainManager } from './ipc';
import { readFiddle } from './utils/read-fiddle';
import { EditorValues } from '../interfaces';
import { IpcEvents } from '../ipc-events';

/**
 * Returns expected content for a given name.
 */
export function getTemplateValues(name: string): Promise<EditorValues> {
  if (path.basename(name) !== name) {
    return Promise.reject(
      new Error(`getTemplateValues: rejected unsafe template name: ${name}`),
    );
  }
  const templatePath = path.join(STATIC_DIR, 'show-me', name.toLowerCase());

  return readFiddle(templatePath);
}

export function setupTemplates() {
  ipcMainManager.handle(
    IpcEvents.GET_TEMPLATE_VALUES,
    (_: IpcMainInvokeEvent, name: string) => getTemplateValues(name),
  );
}
