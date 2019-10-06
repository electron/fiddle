import * as fsExtraType from 'fs-extra';
import * as pathType from 'path';

import { EditorValues } from '../interfaces';
import { INDEX_HTML_NAME, MAIN_JS_NAME, PRELOAD_JS_NAME, RENDERER_JS_NAME } from '../shared-constants';
import { fancyImport } from '../utils/import';

/**
 * Returns expected content for a given name.
 *
 * @param {string} name
 * @returns {Promise<EditorValues>}
 */
export async function getTemplateValues(name: string): Promise<EditorValues> {
  const path = await fancyImport<typeof pathType>('path');
  const fs = await fancyImport<typeof fsExtraType>('fs-extra');
  const templatesPath = path.join(__dirname, '../../static/show-me');
  const templatePath = path.join(templatesPath, name.toLowerCase());

  const getFile = async (fileName: string) => {
    try {
      const filePath = path.join(templatePath, fileName);
      const content = await fs.readFile(filePath, 'utf-8');

      return content;
    } catch (error) {
      console.warn(`getTemplateValues(): Could not get template file:`, error);

      if (fs.existsSync(templatesPath)) {
        const contents = fs.readdirSync(templatesPath);
        console.log(`getTemplateValues(): ${templatesPath} contents:`, contents);
      } else {
        console.log(`getTemplateValues(): ${templatesPath} does not exist`);
      }

      return '';
    }
  };

  return {
    renderer: await getFile(RENDERER_JS_NAME),
    main: await getFile(MAIN_JS_NAME),
    html: await getFile(INDEX_HTML_NAME),
    preload: await getFile(PRELOAD_JS_NAME)
  };
}
