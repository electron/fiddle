import { ElectronVersion } from '../../src/interfaces';

export const mockVersions: Record<string, ElectronVersion> = {
  'v2.0.2': {
    state: 'ready',
    url: 'https://api.github.com/repos/electron/electron/releases/11120972',
    assets_url: 'https://api.github.com/repos/electron/electron/releases/11120972/assets',
    html_url: 'https://github.com/electron/electron/releases/tag/v2.0.2',
    tag_name: 'v2.0.2',
    target_commitish: '2-0-x',
    name: 'electron v2.0.2',
    prerelease: false,
    created_at: '2018-05-22T18:52:16Z',
    published_at: '2018-05-22T20:14:35Z',
    body: '## Bug Fixes\r\n\r\n* Fixed long jitter buffer delays...'
  },
  'v2.0.1': {
    state: 'unknown',
    url: 'https://api.github.com/repos/electron/electron/releases/11032425',
    assets_url: 'https://api.github.com/repos/electron/electron/releases/11032425/assets',
    html_url: 'https://github.com/electron/electron/releases/tag/v2.0.1',
    tag_name: 'v2.0.1',
    target_commitish: '2-0-x',
    name: 'electron v2.0.1',
    prerelease: false,
    created_at: '2018-05-16T17:30:26Z',
    published_at: '2018-05-16T18:40:54Z',
    body: '## Bug Fixes\r\n\r\n* Fixed flaky security-warnings test. #12776,...'
  },
  'v1.8.7': {
    state: 'ready',
    url: 'https://api.github.com/repos/electron/electron/releases/11032343',
    assets_url: 'https://api.github.com/repos/electron/electron/releases/11032343/assets',
    html_url: 'https://github.com/electron/electron/releases/tag/v1.8.7',
    tag_name: 'v1.8.7',
    target_commitish: '1-8-x',
    name: 'electron v1.8.7',
    prerelease: false,
    created_at: '2018-05-16T18:15:18Z',
    published_at: '2018-05-16T18:21:33Z',
    body: '## Bug Fixes\r\n\r\n* Fixed context menu for sandbox devtools. #12734\r\n\r\n*...'
  }
};
