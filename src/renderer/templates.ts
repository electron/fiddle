import * as fsExtraType from 'fs-extra';
import * as pathType from 'path';

import { INDEX_HTML_NAME, MAIN_JS_NAME, RENDERER_JS_NAME } from '../constants';
import { EditorValues } from '../interfaces';
import { fancyImport } from '../utils/import';

/**
 * Returns expected content for a given name. Currently synchronous,
 * but probably shouldn't be.
 *
 * @param {string} name
 * @returns {Promise<EditorValues>}
 */
export async function getTemplateValues(name: string): Promise<EditorValues> {
  const path = await fancyImport<typeof pathType>('path');
  const fs = await fancyImport<typeof fsExtraType>('fs-extra');

  const templatePath = path.join(__dirname, '../static/templates', name);

  const getFile = async (fileName: string) => {
    try {
      const filePath = path.join(templatePath, fileName);
      const content = await fs.readFile(filePath, 'utf-8');

      return content;
    } catch (error) {
      return '';
    }
  };

  return {
    renderer: await getFile(RENDERER_JS_NAME),
    main: await getFile(MAIN_JS_NAME),
    html: await getFile(INDEX_HTML_NAME)
  };
}
