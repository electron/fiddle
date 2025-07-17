import { EventEmitter } from 'node:events';

import { vi } from 'vitest';

import { BrowserWindowMock } from './browser-window';
import { WebContentsMock } from './web-contents';

const createdNotifications: Array<NotificationMock> = [];

class NotificationMock extends EventEmitter {
  public readonly show = vi.fn();

  constructor(public readonly options: any) {
    super();
    createdNotifications.push(this);
  }
}

class Screen extends EventEmitter {
  public readonly getDisplayMatching = vi.fn();
  public readonly getDisplayNearestPoint = vi.fn();
  public readonly getPrimaryDisplay = vi.fn();
  public readonly getCursorScreenPoint = vi.fn();
}

class AutoUpdaterMock extends EventEmitter {
  public readonly quitAndInstall = vi.fn();
}

export class MenuMock {
  public static readonly setApplicationMenu = vi.fn();
  public static readonly sendActionToFirstResponder = vi.fn();
  public static readonly getApplicationMenu = vi.fn();
  public static readonly buildFromTemplate = vi.fn();
  public readonly popup = vi.fn();
  public readonly closePopup = vi.fn();
  public items: Array<MenuItemMock> = [];
  public append(mi: MenuItemMock) {
    this.items.push(mi);
  }
  public insert(pos: number, mi: MenuItemMock) {
    this.items = this.items.splice(pos, 0, mi);
  }
}

export class MessageChannelMainMock {
  public port1: MessagePortMainMock;
  public port2: MessagePortMainMock;

  constructor() {
    this.port1 = new MessagePortMainMock();
    this.port2 = new MessagePortMainMock();
  }
}

export class MessagePortMainMock {
  public once = vi.fn();
  public postMessage = vi.fn();
  public start = vi.fn();
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
  public handle = vi.fn();
  public handleOnce = vi.fn();
  public removeHandler = vi.fn();
  public send = vi.fn();
}

export class IPCRendererMock extends EventEmitter {
  public send = vi.fn();
  public sendSync = vi.fn();
  public invoke = vi.fn();
}

export class ContextBridgeMock {
  public exposeInMainWorld = vi.fn();
}

function CreateWindowStub() {
  return {
    id: 0,
    setMenuBarVisibility: vi.fn(),
    setAutoHideMenuBar: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),
    setTitle: vi.fn(),
    reload: vi.fn(),
    isDestroyed: vi.fn(() => false),
  };
}

const app = {
  addRecentDocument: vi.fn(),
  getName: vi.fn().mockReturnValue('Electron Fiddle'),
  exit: vi.fn(),
  hide: vi.fn(),
  show: vi.fn(),
  isDefaultProtocolClient: vi.fn().mockReturnValue(true),
  setAsDefaultProtocolClient: vi.fn(),
  isReady: vi.fn().mockReturnValue(true),
  isInApplicationsFolder: vi.fn().mockReturnValue(true),
  moveToApplicationsFolder: vi.fn(),
  getAppMetrics: vi.fn().mockReturnValue({ metrics: 123 }),
  getGPUFeatureStatus: vi.fn(),
  getJumpListSettings: vi.fn(() => ({
    removedItems: [],
  })),
  getLoginItemSettings: vi.fn(),
  getPath: vi.fn((name: string) => {
    if (name === 'userData') return '/Users/fake-user';
    if (name === 'home') return `~`;
    return '/test-path';
  }),
  focus: vi.fn(),
  quit: vi.fn(),
  relaunch: vi.fn(),
  setJumpList: vi.fn(),
  requestSingleInstanceLock: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  whenReady: () => Promise.resolve(),
  removeAllListeners: vi.fn(),
};

const mainWindowStub = CreateWindowStub();
const focusedWindowStub = CreateWindowStub();
const autoUpdater = new AutoUpdaterMock();

const session = {
  defaultSession: {
    clearCache: vi.fn((cb) => cb()),
    clearStorageData: vi.fn((_opts, cb) => cb()),
    cookies: {
      get: vi.fn(),
    },
  },
};

const shell = {
  openExternal: vi.fn(),
  openPath: vi.fn(),
  showItemInFolder: vi.fn(),
};

const systemPreferences = {
  getUserDefault: vi.fn(),
};

const electronMock = {
  app,
  autoUpdater,
  BrowserWindow: BrowserWindowMock,
  clipboard: {
    readText: vi.fn(),
    readImage: vi.fn(),
    writeText: vi.fn(),
    writeImage: vi.fn(),
  },
  contextBridge: new ContextBridgeMock(),
  crashReporter: {
    start: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn().mockResolvedValue({}),
    showMessageBox: vi.fn().mockResolvedValue({}),
  },
  ipcMain: new IPCMainMock(),
  ipcRenderer: new IPCRendererMock(),
  nativeImage: {
    createFromPath: (...args: Array<any>) => new NativeImageMock(...args),
    createFromBuffer: vi.fn(),
    createFromDataURL: vi.fn(function () {
      return { toPNG: vi.fn(() => 'content') };
    }),
    createEmpty: vi.fn(),
  },
  match: vi.fn(),
  Menu: MenuMock,
  MenuItem: MenuItemMock,
  MessageChannelMain: MessageChannelMainMock,
  Notification: NotificationMock,
  _notifications: createdNotifications,
  protocol: {
    registerStandardSchemes: vi.fn(),
    registerServiceWorkerSchemes: vi.fn(),
    registerFileProtocol: vi.fn(),
    registerBufferProtocol: vi.fn(),
    registerStringProtocol: vi.fn(),
    registerHttpProtocol: vi.fn(),
    registerStreamProtocol: vi.fn(),
    unregisterProtocol: vi.fn(),
    isProtocolHandled: vi.fn(),
    interceptFileProtocol: vi.fn(),
    interceptStringProtocol: vi.fn(),
    interceptBufferProtocol: vi.fn(),
    interceptHttpProtocol: vi.fn(),
    uninterceptProtocol: vi.fn(),
  },
  require: vi.fn(),
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
