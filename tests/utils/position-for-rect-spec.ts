import { invertPosition, positionForRect } from '../../src/utils/position-for-rect';
import { overridePlatform } from '../utils';

describe('position-for-rect', () => {
  describe('invertPosition()', () => {
    it('inverts "right"', () => {
      expect(invertPosition('right')).toBe('left');
    });

    it('inverts "left"', () => {
      expect(invertPosition('left')).toBe('right');
    });

    it('inverts "top"', () => {
      expect(invertPosition('top')).toBe('bottom');
    });

    it('inverts "bottom"', () => {
      expect(invertPosition('bottom')).toBe('top');
    });

    it('always returns a position', () => {
      expect(invertPosition('xyz' as any)).toBe('top');
    });
  });

  describe('positionForRect()', () => {
    const { innerWidth, innerHeight } = window;

    beforeEach(() => {
      Object.defineProperties(window, {
        innerWidth: { value: innerWidth, writable: true },
        innerHeight: { value: innerHeight, writable: true },
      });
    });

    describe('positionForRect() (Windows, Linux)', () => {
      beforeEach(() => {
        overridePlatform('win32');
      });

      it('returns a position on the top right if doable', () => {
        const target = { left: 50, top: 100, width: 175, height: 50 };
        const size = { width: 200, height: 150 };
        const result = positionForRect(target as any, size);

        expect(result).toEqual({ left: 235, top: 100, type: 'right' });
      });

      it('returns a position on the top left if doable', () => {
        Object.defineProperty(window, 'innerWidth', { value: 575 });

        const target = { left: 400, top: 100, width: 175, height: 50 };
        const size = { width: 200, height: 150 };
        const result = positionForRect(target as any, size);

        expect(result).toEqual({ left: 190, top: 100, type: 'left' });
      });
    });

    describe('positionForRect() (macOS)', () => {
      beforeEach(() => {
        overridePlatform('darwin');
      });

      it('returns a position on the top right if doable', () => {
        const target = { left: 50, top: 100, width: 175, height: 50 };
        const size = { width: 200, height: 150 };
        const result = positionForRect(target as any, size);

        expect(result).toEqual({ left: 235, top: 85, type: 'right' });
      });

      it('returns a position on the top left if doable', () => {
        Object.defineProperty(window, 'innerWidth', { value: 575 });

        const target = { left: 400, top: 100, width: 175, height: 50 };
        const size = { width: 200, height: 150 };
        const result = positionForRect(target as any, size);

        expect(result).toEqual({ left: 190, top: 85, type: 'left' });
      });
    });

    it('returns a position on the bottom middle if doable', () => {
      Object.defineProperty(window, 'innerWidth', { value: 600 });

      const target = { left: 50, top: 100, width: 500, height: 50 };
      const size = { width: 200, height: 150 };
      const result = positionForRect(target as any, size);

      expect(result).toEqual({ left: 200, top: 160, type: 'bottom' });
    });

    it('returns a position in the middle as a last resort', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800 });
      Object.defineProperty(window, 'innerHeight', { value: 600 });

      const target = { left: 50, top: 50, width: 700, height: 500 };
      const size = { width: 200, height: 200 };
      const result = positionForRect(target as any, size);

      expect(result).toEqual({ left: 300, top: 240, type: 'bottom' });
    });
  });
});
