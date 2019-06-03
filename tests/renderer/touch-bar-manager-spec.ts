import { ElectronVersionSource, ElectronVersionState } from '../../src/interfaces';
import { AppState } from '../../src/renderer/state';
import { TouchBarManager } from '../../src/renderer/touch-bar-manager';
import { mockVersions } from '../mocks/electron-versions';
import { overridePlatform, resetPlatform } from '../utils';

describe('TouchBarManager', () => {
  const appState = new AppState();

  beforeAll(() => {
    overridePlatform('darwin');
  });

  afterAll(() => {
    resetPlatform();
  });

  beforeEach(() => {
    appState.versions = mockVersions;
    appState.isRunning = false;

    appState.versions['2.0.1'].state = ElectronVersionState.unknown;
  });

  it('creates a touch bar with versions', () => {
    const touchBarMgr = new TouchBarManager(appState);

    expect(touchBarMgr.versionSelector.items).toHaveLength(3);

    const [ item ] = touchBarMgr.versionSelector.items;

    expect(item.icon).toBe(undefined);
    expect(item.label).toBe(`💾 2.0.2`);
  });

  it('updates the versions when the versions change', () => {
    const touchBarMgr = new TouchBarManager(appState);
    appState.versions['3.3.3'] = {
      state: ElectronVersionState.downloading,
      source: ElectronVersionSource.remote,
      version: '3.3.3'
    };

    expect(touchBarMgr.versionSelector.items).toHaveLength(4);

    const [ item ] = touchBarMgr.versionSelector.items;

    expect(item.icon).toBe(undefined);
    expect(item.label).toBe(`⏬ 3.3.3`);
  });

  it('start/stop btn updates the label', () => {
    const touchBarMgr = new TouchBarManager(appState);
    expect(touchBarMgr.startStopBtn.label).toBe(`🚀 Run`);

    appState.isRunning = true;

    expect(touchBarMgr.startStopBtn.label).toBe(`🛑 Stop`);
  });

  it('start/stop btn handles a click', async () => {
    const touchBarMgr = new TouchBarManager(appState);
    const { click } = touchBarMgr.getStartStopButtonOptions();

    click!();
    expect(window.ElectronFiddle.app.runner.run).toHaveBeenCalledTimes(1);

    appState.isRunning = true;

    click!();
    expect(window.ElectronFiddle.app.runner.stop).toHaveBeenCalledTimes(1);
  });

  it('version btn handles a click and opens version scrubber', async () => {
    const touchBarMgr = new TouchBarManager(appState);
    touchBarMgr.setTouchBar = jest.fn();

    const { click } = touchBarMgr.getVersionButtonOptions();
    click!();

    expect(touchBarMgr.setTouchBar).toHaveBeenCalledTimes(1);
  });

  it('version scrubber "back" button does not select version', () => {
    const touchBarMgr = new TouchBarManager(appState);
    const { click } = touchBarMgr.getVersionSelectorEscButtonOptions();

    touchBarMgr.selectedVersion = '3.3.3';
    expect(appState.version).toBe('5.0.0-beta.7');
    click!();
    expect(appState.version).toBe('5.0.0-beta.7');
  });

  it('version scrubber "select" method goes from index to version', () => {
    const touchBarMgr = new TouchBarManager(appState);
    expect(touchBarMgr.selectedVersion).toBe('');

    touchBarMgr.selectVersion(1);
    expect(touchBarMgr.selectedVersion).toBe('2.0.1');
  });

  it('version scrubber "select" button does select version', () => {
    const touchBarMgr = new TouchBarManager(appState);
    const { click } = touchBarMgr.getVersionSelectorSelectButtonOptions();
    appState.setVersion = jest.fn();

    touchBarMgr.selectedVersion = '2.0.1';
    click();
    expect(appState.setVersion).toHaveBeenCalledWith('2.0.1');
  });
});
