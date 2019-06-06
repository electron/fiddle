import {
  remote,
  TouchBarButtonConstructorOptions,
  TouchBarScrubberConstructorOptions
} from 'electron';
import { autorun } from 'mobx';

import { ElectronVersion, ElectronVersionState } from '../interfaces';
import { getNiceGreeting } from '../utils/nice-greeting';
import { sortedElectronMap } from '../utils/sorted-electron-map';
import { AppState } from './state';

const { TouchBar } = remote;
const {
  TouchBarButton,
  TouchBarScrubber,
  TouchBarSpacer,
  TouchBarLabel
} = TouchBar;

/**
 * Helper method: Returns an icon (emoji, lol) for an Electron
 * version.
 *
 * @param {Partial<ElectronVersion>} { state }
 * @returns {string}
 */
export function getItemIcon(
  { state }: Partial<ElectronVersion> = { state: ElectronVersionState.unknown }
) {
  return state === 'ready'
    ? '💾'
    : state === 'downloading' ? '⏬' : '☁';
}

export class TouchBarManager {
  public browserWindow: Electron.BrowserWindow;
  public consoleBtn: Electron.TouchBarButton;
  public startStopBtn: Electron.TouchBarButton;
  public touchBar: Electron.TouchBar;
  public versionSelector: Electron.TouchBarScrubber;
  public versionSelectorBtn: Electron.TouchBarButton;
  public selectedVersion: string = '';
  public versionSelectorSelectBtn: Electron.TouchBarButton;
  // Lol have mercy, TS
  public items: Array<Electron.TouchBarButton
    | Electron.TouchBarColorPicker
    | Electron.TouchBarGroup
    | Electron.TouchBarLabel
    | Electron.TouchBarPopover
    | Electron.TouchBarScrubber
    | Electron.TouchBarSegmentedControl
    | Electron.TouchBarSlider
    | Electron.TouchBarSpacer>
    | undefined;

  constructor(public readonly appState: AppState) {
    this.selectVersion = this.selectVersion.bind(this);
    this.updateStartStopBtn = this.updateStartStopBtn.bind(this);
    this.updateVersionSelectorItems = this.updateVersionSelectorItems.bind(this);
    this.updateVersionButton = this.updateVersionButton.bind(this);

    this.startStopBtn = new TouchBarButton(this.getStartStopButtonOptions());
    this.consoleBtn = new TouchBarButton(this.getConsoleButtonOptions());
    this.versionSelectorBtn = new TouchBarButton(this.getVersionButtonOptions());
    this.versionSelectorSelectBtn = new TouchBarButton(this.getVersionSelectorSelectButtonOptions());
    this.versionSelector = new TouchBarScrubber(this.getVersionSelectorOptions());

    this.setupTouchBar();
  }

  /**
   * This method is called right after we instantiate the manager. It sets up
   * autoruns that respond to state changes (like new versions) and also
   * greets the user with a kind little message.
   */
  public setupTouchBar() {
    // First, the welcome
    this.setWelcomeItems();

    // Then, go with the intro
    setTimeout(() => {
      this.setDefaultItems();
    }, 4000);

    autorun(this.updateStartStopBtn);
    autorun(this.updateVersionSelectorItems);
    autorun(this.updateVersionButton);
  }

  /**
   * Whenever run/stop status changes, we'll update it (thanks, mobx)
   */
  public updateStartStopBtn() {
    const { label } = this.getStartStopButtonOptions();
    this.startStopBtn.label = label!;
  }

  /**
   * Whenever the electron versions change, we'll update
   * the items in the scrubber (thanks, mobx)
   */
  public updateVersionSelectorItems() {
    this.versionSelector.items = this.getVersions();
  }

  /**
   * Whenever the Electron version changes, update the version button
   */
  public updateVersionButton() {
    const { label } = this.getVersionButtonOptions();
    this.versionSelectorBtn.label = label!;
  }

  public getVersions() {
    return sortedElectronMap(this.appState.versions || {}, (key, version) => ({
      label: `${getItemIcon(version)} ${key}`,
    }));
  }

  /**
   * Safely set the touch bar on the current window
   *
   * @param {Partial<Electron.TouchBarConstructorOptions>} options
   */
  public setTouchBar(options: Partial<Electron.TouchBarConstructorOptions>) {
    try {
      this.items = options.items;
      this.touchBar = new TouchBar(options as Electron.TouchBarConstructorOptions);
      this.browserWindow = this.browserWindow || remote.getCurrentWindow();
      this.browserWindow.setTouchBar(this.touchBar);
    } catch (error) {
      console.warn(`Could not set touch bar`, { error });
    }
  }

  /**
   * A bar that just contains a little welcome message
   */
  public setWelcomeItems() {
    this.setTouchBar({
      items: [
        new TouchBarSpacer({ size: 'flexible' }),
        new TouchBarLabel({ label: getNiceGreeting() }),
        new TouchBarSpacer({ size: 'flexible' })
      ]
    });
  }

  /**
   * A bar with the default items
   */
  public setDefaultItems() {
    this.setTouchBar({
      items: [
        this.startStopBtn,
        this.consoleBtn,
        new TouchBarSpacer({ size: 'flexible' }),
        this.versionSelectorBtn,
        new TouchBarSpacer({ size: 'flexible' })
      ]
    });
  }

  /**
   * A bar that just contains the version scrubber
   */
  public setVersionSelectorItems() {
    this.setTouchBar({
      items: [
        this.versionSelector,
        this.versionSelectorSelectBtn,
      ],
      escapeItem: new TouchBarButton(
        this.getVersionSelectorEscButtonOptions()
      )
    });
  }

  /**
   * The version selector gets a custom "escape" button that'll
   * take the user back to the "default" touch bar interface
   */
  public getVersionSelectorEscButtonOptions() {
    return {
      label: `Back`,
      click: () => {
        this.setDefaultItems();
      }
    };
  }

  /**
   * The version selector also gets a "select" button that'll
   * commit the selected version
   */
  public getVersionSelectorSelectButtonOptions() {
    return {
      label: `🎯 Select`,
      click: () => {
        if (this.selectedVersion) {
          this.appState.setVersion(this.selectedVersion);
        }

        this.setDefaultItems();
      }
    };
  }

  /**
   * The start button is wired up to launching the current
   * fiddle.
   *
   * @returns {TouchBarButtonConstructorOptions}
   */
  public getStartStopButtonOptions(): TouchBarButtonConstructorOptions {
    const label = this.appState.isRunning
      ? '🛑 Stop'
      : '🚀 Run';

    const click = () => this.appState.isRunning
      ? window.ElectronFiddle.app.runner.stop()
      : window.ElectronFiddle.app.runner.run();

    return { label, click };
  }

  /**
   * The console button is wired up to toggle the console
   *
   * @returns {TouchBarButtonConstructorOptions}
   */
  public getConsoleButtonOptions(): TouchBarButtonConstructorOptions {
    const label = '🖥 Console';
    const click = this.appState.toggleConsole;

    return { label, click };
  }

  /**
   *  The version button opens the scrubber, allowing selection
   *  of a version
   *
   * @returns {TouchBarButtonConstructorOptions}
   */
  public getVersionButtonOptions(): TouchBarButtonConstructorOptions {
    const label = `🔖 Electron ${this.appState.version}`;
    const click = () => this.setVersionSelectorItems();

    return { label, click };
  }

  /**
   * Options for the version selection scrubber
   *
   * @returns {TouchBarScrubberConstructorOptions}
   */
  public getVersionSelectorOptions(
  ): TouchBarScrubberConstructorOptions {
    return {
      select: this.selectVersion,
      highlight: this.selectVersion,
      items: [],
      selectedStyle: 'background',
      overlayStyle: 'outline',
      mode: 'free',
      continuous: true,
      showArrowButtons: false
    };
  }

  /**
   * Called once the version selection scrubber is closed (
   * with confirmation)
   *
   * @param {number} index
   */
  public selectVersion(index: number) {
    const versions = sortedElectronMap(this.appState.versions || {}, (k) => k);

    this.selectedVersion = versions[index];
  }
}
