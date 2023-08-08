import { readFiddle } from './utils/read-fiddle';

/**
 * Tries to open a fiddle.
 */
export async function openFiddle(
  filePath: string,
): Promise<Record<string, string>> {
  console.log(`file-manager: Asked to open`, filePath);
  return readFiddle(filePath, true);
}
