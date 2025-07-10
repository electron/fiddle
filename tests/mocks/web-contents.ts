import { EventEmitter } from 'node:events';

import { vi } from 'vitest';

export class WebContentsMock extends EventEmitter {
  public static fromId = vi.fn();
  public static getAllWebContents = vi.fn();
  public static getFocusedWebContents = vi.fn();

  public addWorkSpace = vi.fn();
  public beginFrameSubscription = vi.fn();
  public canGoBack = vi.fn();
  public canGoForward = vi.fn();
  public canGoToOffset = vi.fn();
  public capturePage = vi.fn();
  public clearHistory = vi.fn();
  public closeDevTools = vi.fn();
  public copy = vi.fn();
  public copyImageAt = vi.fn();
  public cut = vi.fn();
  public delete = vi.fn();
  public destroy = vi.fn();
  public disableDeviceEmulation = vi.fn();
  public downloadURL = vi.fn();
  public enableDeviceEmulation = vi.fn();
  public endFrameSubscription = vi.fn();
  public executeJavaScript = vi.fn();
  public focus = vi.fn();
  public getFrameRate = vi.fn();
  public getOSProcessId = vi.fn();
  public getPrinters = vi.fn();
  public getTitle = vi.fn();
  public getURL = vi.fn();
  public getUserAgent = vi.fn();
  public getWebRTCIPHandlingPolicy = vi.fn();
  public getZoomFactor = vi.fn();
  public getZoomLevel = vi.fn();
  public goBack = vi.fn();
  public goForward = vi.fn();
  public goToIndex = vi.fn();
  public goToOffset = vi.fn();
  public hasServiceWorker = vi.fn();
  public insertCSS = vi.fn();
  public inspectElement = vi.fn();
  public inspectServiceWorker = vi.fn();
  public invalidate = vi.fn();
  public isCrashed = vi.fn();
  public isDestroyed = vi.fn();
  public isDevToolsFocused = vi.fn();
  public isDevToolsOpened = vi.fn();
  public isLoading = vi.fn();
  public isLoadingMainFrame = vi.fn();
  public isOffscreen = vi.fn();
  public isPainting = vi.fn();
  public isWaitingForResponse = vi.fn();
  public loadURL = vi.fn();
  public openDevTools = vi.fn();
  public paste = vi.fn();
  public pasteAndMatchStyle = vi.fn();
  public postMessage = vi.fn();
  public print = vi.fn();
  public printToPDF = vi.fn();
  public redo = vi.fn();
  public reload = vi.fn();
  public reloadIgnoringCache = vi.fn();
  public removeWorkSpace = vi.fn();
  public replace = vi.fn();
  public replaceMisspelling = vi.fn();
  public savePage = vi.fn();
  public selectAll = vi.fn();
  public send = vi.fn();
  public sendInputEvent = vi.fn();
  public setAudioMuted = vi.fn();
  public setFrameRate = vi.fn();
  public setIgnoreMenuShortCuts = vi.fn();
  public setLayoutZoomLevelLimits = vi.fn();
  public setSize = vi.fn();
  public setUserAgent = vi.fn();
  public setVisualZoomLevelLimits = vi.fn();
  public setWindowOpenHandler = vi.fn();
  public setWebRTCIPHandlingPolicy = vi.fn();
  public setZoomFactor = vi.fn();
  public setZoomLevel = vi.fn();
  public showDefenitionForSelection = vi.fn();
  public startDrag = vi.fn();
  public startPainting = vi.fn();
  public stop = vi.fn();
  public stopFindInPage = vi.fn();
  public stopPainting = vi.fn();
  public toggleDevTools = vi.fn();
  public undo = vi.fn();
  public unregisterServiceWorker = vi.fn();
  public unselect = vi.fn();

  public idMock = vi.fn();
  public session = null;
  public hostWebContents = null;
  public devToolsWebContents = null;
  public debugger = null;

  constructor() {
    super();
  }

  public get id() {
    return this.idMock();
  }
}
