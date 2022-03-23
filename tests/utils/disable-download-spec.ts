import { disableDownload } from '../../src/utils/disable-download';
import { isJest } from '../../src/utils/is-jest';

jest.mock('../../src/utils/is-jest');

describe('disableDownload', () => {
  // versions below 11.0.0 are not available for download on darwin arm64
  it('returns false for downloadable versions and true otherwise', () => {
    if (process.platform == 'darwin' && process.arch == 'arm64') {
      (isJest as any).mockReturnValueOnce(false).mockReturnValueOnce(false);
      expect(disableDownload('10.0.0')).toBe(true);
      expect(disableDownload('12.0.0')).toBe(false);
    } else {
      (isJest as any).mockReturnValueOnce(false).mockReturnValueOnce(false);
      expect(disableDownload('10.0.0')).toBe(false);
      expect(disableDownload('12.0.0')).toBe(false);
    }

    (isJest as any).mockReturnValueOnce(false).mockReturnValueOnce(false);

    expect(disableDownload('12.0.0')).toBe(false);
    expect(disableDownload('11.0.0')).toBe(false);
  });
});
