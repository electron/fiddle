import { EventEmitter } from 'events';
import { MockBrowserWindow } from './browser-window';
import { MockWebContents } from './web-contents';

const createdNotifications: Array<MockNotification> = [];

class MockNotification extends EventEmitter {
  public readonly show = jest.fn();

  constructor(public readonly options: any) {
    super();
    createdNotifications.push(this);
  }
}

class Screen extends EventEmitter {
  public readonly getDisplayMatching = jest.fn();
  public readonly getDisplayNearestPoint = jest.fn();
  public readonly getPrimaryDisplay = jest.fn();
  public readonly getCursorScreenPoint = jest.fn();
}

class MockAutoUpdater extends EventEmitter {
  public readonly quitAndInstall = jest.fn();
}

export class MockMenu {
  public static readonly setApplicationMenu = jest.fn();
  public static readonly getApplicationMenu = jest.fn();
  public static readonly buildFromTemplate = jest.fn();
  public readonly popup = jest.fn();
  public readonly closePopup = jest.fn();
  public items: Array<MockMenuItem> = [];
  public append(mi: MockMenuItem) {
    this.items.push(mi);
  }
  public insert(pos: number, mi: MockMenuItem) {
    this.items = this.items.splice(pos, 0, mi);
  }
}

export class MockNativeImage {
  public readonly args: Array<any>;
  constructor(...args: Array<any>) {
    this.args = args;
  }
}

export class MockMenuItem {
  public enabled: boolean;
  public visible: boolean;
  public label: string;
  public type: string;
  public click: (menuItem: Electron.MenuItem, browserWindow: Electron.BrowserWindow, event: Electron.Event) => void;

  constructor(options: Electron.MenuItemConstructorOptions) {
    this.enabled = !!options.enabled;
    this.label = options.label!;
    this.click = options.click!;
    this.visible = !!options.visible;
    this.type = options.type as string;
  }
}

export class MockIPC extends EventEmitter {
  public send: any;

  constructor() {
    super();
    this.send = jest.fn();
  }
}

function CreateWindowStub() {
  return {
    id: 0,
    setMenuBarVisibility: jest.fn(),
    setAutoHideMenuBar: jest.fn(),
    setIgnoreMouseEvents: jest.fn(),
    setTitle: jest.fn(),
    reload: jest.fn(),
    isDestroyed: jest.fn(() => false),
    setTouchBar: jest.fn()
  };
}

class MockTouchBar {
  public static TouchBarButton = jest.fn();
  public static TouchBarScrubber = jest.fn();
  public static TouchBarSpacer = jest.fn();
  public static TouchBarLabel = jest.fn();
}

const app = {
  getName: jest.fn().mockReturnValue('Electron Fiddle'),
  exit: jest.fn(),
  hide: jest.fn(),
  show: jest.fn(),
  isDefaultProtocolClient: jest.fn().mockReturnValue(true),
  setAsDefaultProtocolClient: jest.fn(),
  isReady: jest.fn().mockReturnValue(true),
  isInApplicationsFolder: jest.fn().mockReturnValue(true),
  moveToApplicationsFolder: jest.fn(),
  getAppMetrics: jest.fn().mockReturnValue({ metrics: 123 }),
  getGPUFeatureStatus: jest.fn(),
  getJumpListSettings: jest.fn(() => ({
    removedItems: []
  })),
  getLoginItemSettings: jest.fn(),
  getPath: (name: string) => {
    if (name === 'userData') return '/Users/fake-user';
    if (name === 'home') return `~`;
    return '/test-path';
  },
  focus: jest.fn(),
  quit: jest.fn(),
  relaunch: jest.fn(),
  setJumpList: jest.fn(),
  requestSingleInstanceLock: jest.fn(),
  on: jest.fn(),
  once: jest.fn()
};

const mainWindowStub = CreateWindowStub();
const focusedWindowStub = CreateWindowStub();
const autoUpdater = new MockAutoUpdater();

const session = {
  defaultSession: {
    clearCache: jest.fn((cb) => cb()),
    clearStorageData: jest.fn((_opts, cb) => cb()),
    cookies: {
      get: jest.fn()
    }
  }
};

const shell = {
  openExternal: jest.fn(),
  openItem: jest.fn(),
  showItemInFolder: jest.fn()
};

const systemPreferences = {
  getUserDefault: jest.fn()
};

const electronMock = {
  app,
  autoUpdater,
  BrowserWindow: MockBrowserWindow,
  clipboard: {
    readText: jest.fn(),
    readImage: jest.fn(),
    writeText: jest.fn(),
    writeImage: jest.fn()
  },
  dialog: {
    showOpenDialog: jest.fn(() => Promise.resolve({})),
    showMessageBox: jest.fn(() => Promise.resolve({}))
  },
  ipcMain: new MockIPC(),
  ipcRenderer: new MockIPC(),
  nativeImage: {
    createFromPath: (...args: Array<any>) => new MockNativeImage(...args),
    createFromBuffer: jest.fn(),
    createFromDataURL: jest.fn(function() {
      return { toPNG: jest.fn(() => 'content') };
    }),
    createEmpty: jest.fn(),
  },
  match: jest.fn(),
  Menu: MockMenu,
  MenuItem: MockMenuItem,
  Notification: MockNotification,
  _notifications: createdNotifications,
  protocol: {
    registerStandardSchemes: jest.fn(),
    registerServiceWorkerSchemes: jest.fn(),
    registerFileProtocol: jest.fn(),
    registerBufferProtocol: jest.fn(),
    registerStringProtocol: jest.fn(),
    registerHttpProtocol: jest.fn(),
    registerStreamProtocol: jest.fn(),
    unregisterProtocol: jest.fn(),
    isProtocolHandled: jest.fn(),
    interceptFileProtocol: jest.fn(),
    interceptStringProtocol: jest.fn(),
    interceptBufferProtocol: jest.fn(),
    interceptHttpProtocol: jest.fn(),
    uninterceptProtocol: jest.fn()
  },
  remote: {
    app,
    session,
    BrowserWindow: MockBrowserWindow,
    getCurrentWindow: jest.fn(),
    getGlobal: jest.fn(),
    Menu: MockMenu,
    MenuItem: MockMenuItem,
    process: {
      argv: [ '/Applications/Electron Fiddle.app/Contents/MacOS/electron-fiddle' ]
    },
    shell,
    require: jest.fn(),
    TouchBar: MockTouchBar,
    systemPreferences,
  },
  require: jest.fn(),
  screen: new Screen(),
  session,
  shell,
  systemPreferences,
  TouchBar: MockTouchBar,
  webContents: MockWebContents
};

electronMock.BrowserWindow.getAllWindows.mockReturnValue([]);
electronMock.BrowserWindow.fromId.mockReturnValue(mainWindowStub);
electronMock.BrowserWindow.getFocusedWindow.mockReturnValue(focusedWindowStub);
electronMock.remote.getCurrentWindow.mockReturnValue(mainWindowStub);

module.exports = electronMock;
