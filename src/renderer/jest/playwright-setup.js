const { electron: playwright } = require('playwright-electron');

beforeEach(async () => {
  global.app = await playwright.launch(global.binaryPath, {
    args: [global.dir]
  }
  );
})

afterEach(async () => {
  await global.app.close();
})
