const { electron: playwright } = require('playwright-electron');

describe('erick testing', function() {
  beforeEach(async () => {
    this.app = await playwright.launch('/Users/ezhao/Library/Application Support/Electron Fiddle/electron-bin/12.0.0/Electron.app/Contents/MacOS/Electron', {
      args: [__dirname]
    }
    );
  });

  afterEach(async () => {
    await this.app.close();
  })

  it('succeeds', async () => {
    const appVersion = await this.app.evaluate(async ({ app }) => {
      // This runs in the main Electron process, first parameter is
      // the result of the require('electron') in the main app script.
      return app.getVersion();
    });
    console.log(appVersion);
    expect(typeof appVersion).toBe('string');
  });
});
