import * as path from 'node:path';

import { ErrorCode } from '../shared/errors';
import { reasonError } from './error-reasons';
import { SHOW_ME_EXAMPLES, type ShowMeExampleName } from '../shared/examples';
import type { FileMap } from './files';
import { readFiddleFolder } from './folder';

/** An example's display name, matched ignoring case. Its folder under `static/show-me/` is the name in lower case. */
export function findExample(name: string): ShowMeExampleName | undefined {
  const lower = name.toLowerCase();
  return SHOW_ME_EXAMPLES.find((example) => example.toLowerCase() === lower);
}

/** Loads `<staticDir>/show-me/<name>/`. */
export async function loadExample(staticDir: string, name: string): Promise<FileMap> {
  const example = findExample(name);
  if (!example)
    throw reasonError(
      ErrorCode.notFound,
      'example-not-found',
      `No example named "${name}"`,
      {
        name,
      },
    );
  const dir = path.join(staticDir, 'show-me', example.toLowerCase());
  return (await readFiddleFolder(dir)).files;
}
