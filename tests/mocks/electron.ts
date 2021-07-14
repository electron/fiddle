import { EventEmitter } from 'events';
import { BrowserWindowMock } from './browser-window';
import { WebContentsMock } from './web-contents';

const createdNotifications: Array<NotificationMock> = [];

class NotificationMock extends EventEmitter {
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

class AutoUpdaterMock extends EventEmitter {
  public readonly quitAndInstall = jest.fn();
}

export class MenuMock {
  public static readonly setApplicationMenu = jest.fn();
  public static readonly sendActionToFirstResponder = jest.fn();
  public static readonly getApplicationMenu = jest.fn();
  public static readonly buildFromTemplate = jest.fn();
  public readonly popup = jest.fn();
  public readonly closePopup = jest.fn();
  public items: Array<MenuItemMock> = [];
  public append(mi: MenuItemMock) {
    this.items.push(mi);
  }
  public insert(pos: number, mi: MenuItemMock) {
    this.items = this.items.splice(pos, 0, mi);
  }
}

export class NativeImageMock {
  public readonly args: Array<any>;
  constructor(...args: Array<any>) {
    this.args = args;
  }
}

export class MenuItemMock {
  public enabled: boolean;
  public visible: boolean;
  public label: string;
  public type: string;
  public click: (
    menuItem: Electron.MenuItem,
    browserWindow: Electron.BrowserWindow | undefined,
    event: KeyboardEvent,
  ) => void;

  constructor(options: Electron.MenuItemConstructorOptions) {
    this.enabled = !!options.enabled;
    this.label = options.label!;
    this.click = options.click!;
    this.visible = !!options.visible;
    this.type = options.type as string;
  }
}

export class IPCMainMock extends EventEmitter {
  public handle = jest.fn();
  public handleOnce = jest.fn();
  public removeHandler = jest.fn();
  public send = jest.fn();
}

export class IPCRendererMock extends EventEmitter {
  public send = jest.fn();
  public invoke = jest.fn();
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
  };
}

const app = {
  addRecentDocument: jest.fn(),
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
    removedItems: [],
  })),
  getLoginItemSettings: jest.fn(),
  getPath: jest.fn((name: string) => {
    if (name === 'userData') return '/Users/fake-user';
    if (name === 'home') return `~`;
    return '/test-path';
  }),
  focus: jest.fn(),
  quit: jest.fn(),
  relaunch: jest.fn(),
  setJumpList: jest.fn(),
  requestSingleInstanceLock: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  once: jest.fn(),
  whenReady: () => Promise.resolve(),
  removeAllListeners: jest.fn(),
};

const mainWindowStub = CreateWindowStub();
const focusedWindowStub = CreateWindowStub();
const autoUpdater = new AutoUpdaterMock();

const session = {
  defaultSession: {
    clearCache: jest.fn((cb) => cb()),
    clearStorageData: jest.fn((_opts, cb) => cb()),
    cookies: {
      get: jest.fn(),
    },
  },
};

const shell = {
  openExternal: jest.fn(),
  openPath: jest.fn(),
  showItemInFolder: jest.fn(),
};

const systemPreferences = {
  getUserDefault: jest.fn(),
};

const electronMock = {
  app,
  autoUpdater,
  BrowserWindow: BrowserWindowMock,
  clipboard: {
    readText: jest.fn(),
    readImage: jest.fn(),
    writeText: jest.fn(),
    writeImage: jest.fn(),
  },
  crashReporter: {
    start: jest.fn(),
  },
  dialog: {
    showOpenDialog: jest.fn().mockResolvedValue({}),
    showOpenDialogSync: jest.fn().mockReturnValue(['path']),
    showMessageBox: jest.fn().mockResolvedValue({}),
  },
  ipcMain: new IPCMainMock(),
  ipcRenderer: new IPCRendererMock(),
  nativeImage: {
    createFromPath: (...args: Array<any>) => new NativeImageMock(...args),
    createFromBuffer: jest.fn(),
    createFromDataURL: jest.fn(function () {
      return { toPNG: jest.fn(() => 'content') };
    }),
    createEmpty: jest.fn(),
  },
  match: jest.fn(),
  Menu: MenuMock,
  MenuItem: MenuItemMock,
  Notification: NotificationMock,
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
    uninterceptProtocol: jest.fn(),
  },
  require: jest.fn(),
  screen: new Screen(),
  session,
  shell,
  systemPreferences,
  webContents: WebContentsMock,
};

electronMock.BrowserWindow.getAllWindows.mockReturnValue([]);
electronMock.BrowserWindow.fromId.mockReturnValue(mainWindowStub);
electronMock.BrowserWindow.fromWebContents.mockReturnValue(mainWindowStub);
electronMock.BrowserWindow.getFocusedWindow.mockReturnValue(focusedWindowStub);

module.exports = electronMock;
