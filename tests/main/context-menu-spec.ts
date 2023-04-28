/**
 * @jest-environment node
 */

import { BrowserWindow, ContextMenuParams, Menu } from 'electron';

import {
  createContextMenu,
  getInspectItems,
  getMonacoItems,
  getRunItems,
} from '../../src/main/context-menu';
import { ipcMainManager } from '../../src/main/ipc';
import { isDevMode } from '../../src/main/utils/devmode';
import { BrowserWindowMock } from '../mocks/browser-window';
import { WebContentsMock } from '../mocks/web-contents';

jest.mock('../../src/main/utils/devmode');
jest.mock('../../src/main/ipc');

describe('context-menu', () => {
  let mockWindow: BrowserWindow;
  const mockFlags = {
    editFlags: {
      canCopy: false,
      canCut: false,
      canPaste: false,
    },
    selectionText: null,
    isEditable: false,
  };

  beforeEach(() => {
    ipcMainManager.removeAllListeners();
    mockWindow = (new BrowserWindowMock() as unknown) as BrowserWindow;
    createContextMenu(mockWindow);
  });

  describe('getContextMenu()', () => {
    it('attaches to the context-menu', () => {
      const eventNames = mockWindow.webContents.eventNames();
      expect(eventNames).toEqual(['context-menu']);
    });

    it('creates a default context-menu with inspect for dev mode', () => {
      (Menu.buildFromTemplate as jest.Mock).mockReturnValue({
        popup: jest.fn(),
      });
      (isDevMode as jest.Mock).mockReturnValueOnce(true);

      mockWindow.webContents.emit('context-menu', null, mockFlags);

      expect(Menu.buildFromTemplate).toBeCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'run' }),
          expect.objectContaining({ id: 'clear_console' }),
          expect.objectContaining({ type: 'separator' }),
          expect.objectContaining({ id: 'cut' }),
          expect.objectContaining({ id: 'paste' }),
          expect.objectContaining({ type: 'separator' }),
          expect.objectContaining({ id: 'inspect' }),
        ]),
      );
    });

    it('creates a default context-menu without inspect in production', () => {
      (Menu.buildFromTemplate as jest.Mock).mockReturnValue({
        popup: jest.fn(),
      });
      (isDevMode as jest.Mock).mockReturnValueOnce(false);

      mockWindow.webContents.emit('context-menu', null, mockFlags);
      const template = (Menu.buildFromTemplate as jest.Mock).mock.calls[0][0];

      expect(template).toHaveLength(7);
    });

    it('disables cut/copy/paste if not in editFlags', () => {
      (Menu.buildFromTemplate as jest.Mock).mockReturnValue({
        popup: jest.fn(),
      });
      (isDevMode as jest.Mock).mockReturnValueOnce(true);

      mockWindow.webContents.emit('context-menu', null, mockFlags);

      expect(Menu.buildFromTemplate).toBeCalledWith(
        expect.arrayContaining([
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.objectContaining({ id: 'cut', enabled: false }),
          expect.objectContaining({ id: 'copy', enabled: false }),
          expect.objectContaining({ id: 'paste', enabled: false }),
          expect.anything(),
          expect.anything(),
        ]),
      );
    });

    it('enables cut/copy/paste if in editFlags', () => {
      (Menu.buildFromTemplate as jest.Mock).mockReturnValue({
        popup: jest.fn(),
      });
      (isDevMode as jest.Mock).mockReturnValueOnce(true);

      mockWindow.webContents.emit('context-menu', null, {
        ...mockFlags,
        editFlags: {
          canCopy: true,
          canPaste: true,
          canCut: true,
        },
      });

      expect(Menu.buildFromTemplate).toBeCalledWith(
        expect.arrayContaining([
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.objectContaining({ id: 'cut', enabled: true }),
          expect.objectContaining({ id: 'copy', enabled: true }),
          expect.objectContaining({ id: 'paste', enabled: true }),
          expect.anything(),
          expect.anything(),
        ]),
      );
    });
  });

  describe('getInspectItems()', () => {
    it('returns an empty array if not in devMode', () => {
      (isDevMode as jest.Mock).mockReturnValueOnce(false);
      const result = getInspectItems(mockWindow, {} as ContextMenuParams);
      expect(result).toHaveLength(0);
    });

    it('returns an inspect item if in devMode', () => {
      (isDevMode as jest.Mock).mockReturnValueOnce(true);
      const result = getInspectItems(mockWindow, {} as ContextMenuParams);
      expect(result).toHaveLength(1);
    });

    it('inspects on click', () => {
      (isDevMode as jest.Mock).mockReturnValueOnce(true);
      const result = getInspectItems(mockWindow, {
        x: 5,
        y: 10,
      } as ContextMenuParams);

      (result[0] as any).click();
      expect(mockWindow.webContents.inspectElement).toHaveBeenCalled();
    });

    it('focuses the dev tools if already open', () => {
      (isDevMode as jest.Mock).mockReturnValueOnce(true);
      const result = getInspectItems(mockWindow, {
        x: 5,
        y: 10,
      } as ContextMenuParams);
      (mockWindow.webContents
        .isDevToolsOpened as jest.Mock).mockReturnValueOnce(true);
      (mockWindow.webContents as any).devToolsWebContents = new WebContentsMock();

      (result[0] as any).click();
      expect(mockWindow.webContents.inspectElement).toHaveBeenCalled();
      expect(
        mockWindow.webContents.devToolsWebContents!.focus as jest.Mock,
      ).toHaveBeenCalled();
    });

    it('catches an error', () => {
      (isDevMode as jest.Mock).mockReturnValueOnce(true);
      const result = getInspectItems(mockWindow, {
        x: 5,
        y: 10,
      } as ContextMenuParams);
      (mockWindow.webContents
        .isDevToolsOpened as jest.Mock).mockReturnValueOnce(true);
      (mockWindow.webContents as any).devToolsWebContents = new WebContentsMock();
      (mockWindow.webContents.devToolsWebContents!
        .focus as jest.Mock).mockImplementationOnce(() => {
        throw new Error('💩');
      });

      (result[0] as any).click();
    });
  });

  describe('getMonacoItems()', () => {
    it('returns an empty array if canPaste is false', () => {
      const result = getMonacoItems({ editFlags: { canPaste: false } } as any);
      expect(result).toHaveLength(0);
    });

    it('returns an array if the page url suggest the editor is up', () => {
      const result = getMonacoItems({
        editFlags: { canPaste: true },
        pageURL: 'index.html',
      } as any);
      expect(result).toHaveLength(9);
    });

    it('executes an IPC send() for each element', () => {
      const result = getMonacoItems({
        editFlags: { canPaste: true },
        pageURL: 'index.html',
      } as any);
      let i = 0;

      result.forEach((item) => {
        if (item.click) {
          i = i + 1;
          (item as any).click();
        }

        expect(ipcMainManager.send).toHaveBeenCalledTimes(i);
      });
    });
  });

  describe('getRunItems()', () => {
    it('executes an IPC send() on click', () => {
      const result = getRunItems();
      (result[0] as any).click();
      expect(ipcMainManager.send).toHaveBeenCalledTimes(1);
    });
  });
});
