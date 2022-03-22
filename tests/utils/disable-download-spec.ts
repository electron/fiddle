import { disableDownload } from '../../src/utils/disable-download';

describe('disableDownload', () => {
  //versions below 11.0.0 are not available for download on darwin arm64
  it('returns false for downloadable versions and true otherwise', () => {
    expect(disableDownload('15.0.0')).toBe(false);
    expect(disableDownload('11.0.0')).toBe(false);

    if (process.platform == 'darwin' && process.arch == 'arm64') {
      expect(disableDownload('10.0.0')).toBe(true);
      expect(disableDownload('8.0.0')).toBe(true);
    } else {
      expect(disableDownload('10.0.0')).toBe(false);
      expect(disableDownload('8.0.0')).toBe(false);
    }
  });
});
