import { Files } from '../../interfaces';

/**
 * This transform adds dotfiles (like .gitignore)
 *
 * @param {Files} files
 * @returns {Promise<Files>}
 */
export async function dotfilesTransform(files: Files): Promise<Files> {
  files.set('.gitignore',  'node_modules\nout');

  return files;
}
