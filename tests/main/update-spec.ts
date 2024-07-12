/**
 * @jest-environment node
 */
import { mocked } from 'jest-mock';

jest.useFakeTimers();
jest.spyOn(global, 'setTimeout');

const mockUpdateApp = jest.fn();
jest.mock('update-electron-app', () => ({ updateElectronApp: mockUpdateApp }));

describe('update', () => {
  const { setupUpdates } = require('../../src/main/update');
  const { updateElectronApp } = require('update-electron-app');

  it('schedules an update check', () => {
    setupUpdates();

    expect(setTimeout).toHaveBeenCalledTimes(1);
    mocked(setTimeout).mock.calls[0][0]();
    expect(updateElectronApp).toHaveBeenCalled();
  });
});
