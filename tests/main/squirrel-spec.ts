import { shouldQuit } from '../../src/main/squirrel';

jest.mock('electron-squirrel-startup', () => ({ mock: true }));

describe('shouldQuit', () => {
  it('returns simply electron-squirrel-startup', () => {
    expect(shouldQuit()).toEqual({ mock: true });
  });
});
