import { getName, getTitle } from '../../src/utils/get-title';

describe('get-title', () => {
  describe('getTitle()', () => {
    it('returns a solid default title', () => {
      const result = getTitle({} as any);
      expect(result).toBe('Electron Fiddle - Unsaved');
    });

    it('returns a title for a Gist', () => {
      const result = getTitle({ gistId: '123' } as any);
      expect(result).toBe('Electron Fiddle - gist.github.com/123');
    });

    it('returns a title for a local fiddle', () => {
      const result = getTitle({ localPath: 'a/b/fiddle' } as any);
      expect(result).toBe('Electron Fiddle - a/b/fiddle');
    });

    it('returns a title for a local & gist fiddle', () => {
      const result = getTitle({ localPath: 'a/b/fiddle', gistId: '123' } as any);
      expect(result).toBe('Electron Fiddle - gist.github.com/123 a/b/fiddle');
    });
  });

  describe('getName()', () => {
    it('returns a random name', async () => {
      const result = await getName({} as any);
      expect(result).toBeTruthy();
    });

    it('returns a name from the local path if saved', async () => {
      const result = await getName({ localPath: 'a/b/myFiddle' } as any);
      expect(result).toBe('myFiddle');
    });
  });
});
