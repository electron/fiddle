import { dotfilesTransform } from '../../src/renderer/transforms/dotfiles';

describe('dotfilesTransform()', () => {
  it('adds a .gitignore file', async () => {
    const files = await dotfilesTransform(new Map());
    expect(files.get('.gitignore')).toBe('node_modules\nout');
  });
});
