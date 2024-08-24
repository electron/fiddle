import { Files } from '../../interfaces';

/**
 * This transform adds dotfiles (like .gitignore)
 */
export async function dotfilesTransform(files: Files): Promise<Files> {
  files.set('.gitignore', 'node_modules\nout');

  return files;
}
