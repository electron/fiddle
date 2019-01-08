jest.useFakeTimers();

const mockUpdateApp = jest.fn();
jest.mock('update-electron-app', () => mockUpdateApp);

describe('update', () => {
  const { setupUpdates } = require('../../src/main/update');
  const updateElectronApp = require('update-electron-app');

  it('schedules an update check', () => {
    setupUpdates();

    expect(setTimeout).toHaveBeenCalledTimes(1);
    (setTimeout as unknown as jest.Mock).mock.calls[0][0]();

    expect(updateElectronApp).toHaveBeenCalled();
  });
});
