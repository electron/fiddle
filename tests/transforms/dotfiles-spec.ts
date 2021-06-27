import { dotfilesTransform } from '../../src/renderer/transforms/dotfiles';

describe('dotfilesTransform()', () => {
  it('adds a .gitignore file', () => {
    const files = dotfilesTransform(new Map());
    expect(files.get('.gitignore')).toBe('node_modules\nout');
  });
});
