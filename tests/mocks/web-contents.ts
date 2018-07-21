import { EventEmitter } from 'events';

export class MockWebContents extends EventEmitter {
  public static fromId = jest.fn();
  public static getAllWebContents = jest.fn();
  public static getFocusedWebContents = jest.fn();

  public addWorkSpace = jest.fn();
  public beginFrameSubscription = jest.fn();
  public canGoBack = jest.fn();
  public canGoForward = jest.fn();
  public canGoToOffset = jest.fn();
  public capturePage = jest.fn();
  public clearHistory = jest.fn();
  public closeDevTools = jest.fn();
  public copy = jest.fn();
  public copyImageAt = jest.fn();
  public cut = jest.fn();
  public delete = jest.fn();
  public destroy = jest.fn();
  public disableDeviceEmulation = jest.fn();
  public downloadURL = jest.fn();
  public enableDeviceEmulation = jest.fn();
  public endFrameSubscription = jest.fn();
  public executeJavaScript = jest.fn();
  public focus = jest.fn();
  public getFrameRate = jest.fn();
  public getOSProcessId = jest.fn();
  public getPrinters = jest.fn();
  public getTitle = jest.fn();
  public getURL = jest.fn();
  public getUserAgent = jest.fn();
  public getWebRTCIPHandlingPolicy = jest.fn();
  public getZoomFactor = jest.fn();
  public getZoomLevel = jest.fn();
  public goBack = jest.fn();
  public goForward = jest.fn();
  public goToIndex = jest.fn();
  public goToOffset = jest.fn();
  public hasServiceWorker = jest.fn();
  public insertCSS = jest.fn();
  public inspectElement = jest.fn();
  public inspectServiceWorker = jest.fn();
  public invalidate = jest.fn();
  public isCrashed = jest.fn();
  public isDevToolsFocused = jest.fn();
  public isDevToolsOpened = jest.fn();
  public isLoading = jest.fn();
  public isLoadingMainFrame = jest.fn();
  public isOffscreen = jest.fn();
  public isPainting = jest.fn();
  public isWaitingForResponse = jest.fn();
  public loadURL = jest.fn();
  public openDevTools = jest.fn();
  public paste = jest.fn();
  public pasteAndMatchStyle = jest.fn();
  public print = jest.fn();
  public printToPDF = jest.fn();
  public redo = jest.fn();
  public reload = jest.fn();
  public reloadIgnoringCache = jest.fn();
  public removeWorkSpace = jest.fn();
  public replace = jest.fn();
  public replaceMisspelling = jest.fn();
  public savePage = jest.fn();
  public selectAll = jest.fn();
  public send = jest.fn();
  public sendInputEvent = jest.fn();
  public setAudioMuted = jest.fn();
  public setFrameRate = jest.fn();
  public setIgnoreMenuShortCuts = jest.fn();
  public setLayoutZoomLevelLimits = jest.fn();
  public setSize = jest.fn();
  public setUserAgent = jest.fn();
  public setVisualZoomLevelLimits = jest.fn();
  public setWebRTCIPHandlingPolicy = jest.fn();
  public setZoomFactor = jest.fn();
  public setZoomLevel = jest.fn();
  public showDefenitionForSelection = jest.fn();
  public startDrag = jest.fn();
  public startPainting = jest.fn();
  public stop = jest.fn();
  public stopFindInPage = jest.fn();
  public stopPainting = jest.fn();
  public toggleDevTools = jest.fn();
  public undo = jest.fn();
  public unregisterServiceWorker = jest.fn();
  public unselect = jest.fn();

  public idMock = jest.fn();
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
