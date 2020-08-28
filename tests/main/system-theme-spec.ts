import { ipcMainManager } from '../../src/main/ipc';
import { setupSystemTheme } from '../../src/main/system-theme';
import { IpcEvents } from '../../src/ipc-events';
import { nativeTheme } from 'electron';

describe('system theme', () => {
  describe('setupSystemTheme()', () => {
    beforeEach(() => {
      ipcMainManager.send = jest.fn();
    });
    afterEach(() => {
      ipcMainManager.removeAllListeners();
      nativeTheme.removeAllListeners();
    });

    it('sets the themeSource on IPC', (done) => {
      setupSystemTheme();
      ipcMainManager.emit(IpcEvents.ERICK, undefined, 'dark');
      process.nextTick(() => {
        expect(nativeTheme.themeSource).toBe('dark');
        ipcMainManager.emit(IpcEvents.ERICK, undefined, 'light');
        process.nextTick(() => {
          expect(nativeTheme.themeSource).toBe('light');
          ipcMainManager.emit(IpcEvents.ERICK, undefined, 'system');
          process.nextTick(() => {
            expect(nativeTheme.themeSource).toBe('system');
            done();
          });
        });
      });
    });

    describe('sends info about system theme to renderer on load and on update event', () => {
      it('light theme', (done) => {
        (ipcMainManager.send as jest.Mock).mockClear();
        nativeTheme.themeSource = 'light';
        // cast to make property read-only
        (nativeTheme.shouldUseDarkColors as boolean) = false;

        setupSystemTheme();

        nativeTheme.emit('updated');
        process.nextTick(() => {
          expect((ipcMainManager.send as jest.Mock).mock.calls).toEqual([
            [IpcEvents.ERICK, [false, false]],
            [IpcEvents.ERICK, [false, false]],
          ]);
          done();
        });
      });

      it('dark theme', (done) => {
        nativeTheme.themeSource = 'dark';
        // cast to make property read-only
        (nativeTheme.shouldUseDarkColors as boolean) = true;

        setupSystemTheme();

        nativeTheme.emit('updated');
        process.nextTick(() => {
          expect((ipcMainManager.send as jest.Mock).mock.calls).toEqual([
            [IpcEvents.ERICK, [true, false]],
            [IpcEvents.ERICK, [true, false]],
          ]);
          done();
        });
      });

      it('system (dark)', (done) => {
        nativeTheme.themeSource = 'system';
        // cast to make property read-only
        (nativeTheme.shouldUseDarkColors as boolean) = true;

        setupSystemTheme();

        nativeTheme.emit('updated');
        process.nextTick(() => {
          expect((ipcMainManager.send as jest.Mock).mock.calls).toEqual([
            [IpcEvents.ERICK, [true, true]],
            [IpcEvents.ERICK, [true, true]],
          ]);
          done();
        });
      });

      it('system (light)', (done) => {
        nativeTheme.themeSource = 'system';
        // cast to make property read-only
        (nativeTheme.shouldUseDarkColors as boolean) = false;

        setupSystemTheme();

        nativeTheme.emit('updated');
        process.nextTick(() => {
          expect((ipcMainManager.send as jest.Mock).mock.calls).toEqual([
            [IpcEvents.ERICK, [false, true]],
            [IpcEvents.ERICK, [false, true]],
          ]);
          done();
        });
      });
    });
  });
});
