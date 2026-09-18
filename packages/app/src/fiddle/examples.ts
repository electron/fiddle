import * as path from 'node:path';

import { ErrorCode, FiddleError } from '../shared/errors';
import { SHOW_ME_EXAMPLES, type ShowMeExampleName } from '../shared/examples';
import type { FileMap } from './files';
import { readFiddleFolder } from './folder';

export interface ExampleInfo {
  name: ShowMeExampleName;
  /** Folder under `static/show-me/`. */
  dir: string;
}

export function listExamples(): ExampleInfo[] {
  return SHOW_ME_EXAMPLES.map((name) => ({ name, dir: name.toLowerCase() }));
}

/** Finds an example by display name or folder name, ignoring case. */
export function findExample(name: string): ExampleInfo | undefined {
  const lower = name.toLowerCase();
  return listExamples().find((e) => e.dir === lower);
}

/** Loads `<staticDir>/show-me/<dir>/`. */
export async function loadExample(staticDir: string, name: string): Promise<FileMap> {
  const example = findExample(name);
  if (!example)
    throw new FiddleError(ErrorCode.notFound, `No example named "${name}"`, { name });
  return (await readFiddleFolder(path.join(staticDir, 'show-me', example.dir))).files;
}
