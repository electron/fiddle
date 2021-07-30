// use a stable-sorting stringify for comparing expected & actual payloads
import stringify from 'json-stable-stringify';

import {
  ElectronReleaseChannel,
  OutputEntry,
  RunResult,
} from '../../src/interfaces';
import { IpcEvents } from '../../src/ipc-events';

import { ipcMainManager } from '../../src/main/ipc';
import { processCommandLine } from '../../src/main/command-line';

jest.unmock('fs-extra');

describe('processCommandLine()', () => {
  // when no fiddle specified, cwd is the default
  const DEFAULT_FIDDLE = `{"filePath":"${process.cwd()}"}`;
  const ARGV_PREFIX = process.defaultApp
    ? ['/path/to/electron', 'main.ts']
    : ['main.ts'];

  beforeEach(() => {
    ipcMainManager.removeAllListeners();
    ipcMainManager.send = jest.fn();
  });

  it('does nothing when passed no arguments', async () => {
    await processCommandLine(ARGV_PREFIX);
    expect(ipcMainManager.send).not.toHaveBeenCalled();
  });

  it('exits with 2 if called with invalid parameters', async () => {
    const argv = [...ARGV_PREFIX, 'test', '--this-option-is-unknown=true'];
    const exitCode = 2;
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation();
    await processCommandLine(argv);
    expect(exitSpy).toHaveBeenCalledWith(exitCode);
    exitSpy.mockReset();
  });

  function expectSendCalledOnceWith(event: IpcEvents, payload: string) {
    const send = ipcMainManager.send as jest.Mock;
    expect(send).toHaveBeenCalledTimes(1);
    const [call] = send.mock.calls;
    expect(call.length).toEqual(2);
    const [ev, params] = call;
    expect(ev).toBe(event);
    expect(params.length).toBe(1);
    const [request] = params;
    expect(stringify(request)).toBe(payload);
  }

  async function expectLogConfigOptionWorks(argv: string[]) {
    argv = [...argv, '--log-config'];
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await processCommandLine(argv);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching('electron-fiddle started'),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(`platform: ${process.platform}`),
    );
    consoleSpy.mockReset();
  }

  describe('test', () => {
    const ARGV = [...ARGV_PREFIX, 'test'];

    function expectTestCalledOnceWith(payload: string) {
      expectSendCalledOnceWith(IpcEvents.TASK_TEST, payload);
    }

    it('uses cwd as the default fiddle location', async () => {
      const argv = ARGV;
      const expected = `{"setup":{"fiddle":${DEFAULT_FIDDLE},"hideChannels":[],"showChannels":[]}}`;
      await processCommandLine(argv);
      expectTestCalledOnceWith(expected);
    });

    it('handles a --fiddle that is a hex gist id', async () => {
      const GIST_ID = 'af3e1a018f5dcce4a2ff40004ef5bab5';
      const argv = [...ARGV, '--fiddle', GIST_ID];
      const expected = `{"setup":{"fiddle":{"gistId":"${GIST_ID}"},"hideChannels":[],"showChannels":[]}}`;
      await processCommandLine(argv);
      expectTestCalledOnceWith(expected);
    });

    it('handles a --fiddle option that is unrecognizable', async () => {
      const FIDDLE = '✨🤪💎';
      const argv = [...ARGV, '--fiddle', FIDDLE];
      const consoleExpected = `Unrecognized Fiddle "${FIDDLE}"`;
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const exitExpected = 2;
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();
      await processCommandLine(argv);
      expect(ipcMainManager.send).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(consoleExpected);
      expect(exitSpy).toHaveBeenCalledWith(exitExpected);
      consoleSpy.mockReset();
      exitSpy.mockReset();
    });

    it('handles a --version option', async () => {
      const VERSION = '12.0.0';
      const argv = [...ARGV, '--version', VERSION];
      const expected = `{"setup":{"fiddle":${DEFAULT_FIDDLE},"hideChannels":[],"showChannels":[],"version":"${VERSION}"}}`;
      await processCommandLine(argv);
      expectTestCalledOnceWith(expected);
    });

    it('handles a --log-config option', async () => {
      await expectLogConfigOptionWorks([...ARGV, '--log-config']);
    });
  });

  describe('bisect', () => {
    const ARGV = [...ARGV_PREFIX, 'bisect'];
    const GOOD = '10.0.0';
    const BAD = '11.2.0';

    function expectBisectCalledOnceWith(payload: string) {
      expectSendCalledOnceWith(IpcEvents.TASK_BISECT, payload);
    }

    it('sends a bisect request', async () => {
      const argv = [...ARGV, GOOD, BAD];
      const expected = `{"badVersion":"${BAD}","goodVersion":"${GOOD}","setup":{"fiddle":${DEFAULT_FIDDLE},"hideChannels":[],"showChannels":[]}}`;
      await processCommandLine(argv);
      expectBisectCalledOnceWith(expected);
    });

    it('handles a --full option', async () => {
      const argv = [...ARGV, GOOD, BAD, '--full'];
      const expected = `{"badVersion":"${BAD}","goodVersion":"${GOOD}","setup":{"fiddle":${DEFAULT_FIDDLE},"hideChannels":[],"showChannels":["${ElectronReleaseChannel.beta}","${ElectronReleaseChannel.nightly}","${ElectronReleaseChannel.stable}"],"useObsolete":true}}`;
      await processCommandLine(argv);
      expectBisectCalledOnceWith(expected);
    });

    it('handles a --nightlies option', async () => {
      const argv = [...ARGV, GOOD, BAD, '--nightlies'];
      const expected = `{"badVersion":"${BAD}","goodVersion":"${GOOD}","setup":{"fiddle":${DEFAULT_FIDDLE},"hideChannels":[],"showChannels":["${ElectronReleaseChannel.nightly}"]}}`;
      await processCommandLine(argv);
      expectBisectCalledOnceWith(expected);
    });

    it('handles a --no-nightlies option', async () => {
      const argv = [...ARGV, GOOD, BAD, '--no-nightlies'];
      const expected = `{"badVersion":"${BAD}","goodVersion":"${GOOD}","setup":{"fiddle":${DEFAULT_FIDDLE},"hideChannels":["${ElectronReleaseChannel.nightly}"],"showChannels":[]}}`;
      await processCommandLine(argv);
      expectBisectCalledOnceWith(expected);
    });

    it('handles a --betas option', async () => {
      const argv = [...ARGV, GOOD, BAD, '--betas'];
      const expected = `{"badVersion":"${BAD}","goodVersion":"${GOOD}","setup":{"fiddle":${DEFAULT_FIDDLE},"hideChannels":[],"showChannels":["${ElectronReleaseChannel.beta}"]}}`;
      await processCommandLine(argv);
      expectBisectCalledOnceWith(expected);
    });

    it('handles a --no-betas option', async () => {
      const argv = [...ARGV, GOOD, BAD, '--no-betas'];
      const expected = `{"badVersion":"${BAD}","goodVersion":"${GOOD}","setup":{"fiddle":${DEFAULT_FIDDLE},"hideChannels":["${ElectronReleaseChannel.beta}"],"showChannels":[]}}`;
      await processCommandLine(argv);
      expectBisectCalledOnceWith(expected);
    });

    it('handles a --obsolete option', async () => {
      const argv = [...ARGV, GOOD, BAD, '--obsolete'];
      const expected = `{"badVersion":"${BAD}","goodVersion":"${GOOD}","setup":{"fiddle":${DEFAULT_FIDDLE},"hideChannels":[],"showChannels":[],"useObsolete":true}}`;
      await processCommandLine(argv);
      expectBisectCalledOnceWith(expected);
    });

    it('handles a --no-obsolete option', async () => {
      const argv = [...ARGV, GOOD, BAD, '--no-obsolete'];
      const expected = `{"badVersion":"${BAD}","goodVersion":"${GOOD}","setup":{"fiddle":${DEFAULT_FIDDLE},"hideChannels":[],"showChannels":[],"useObsolete":false}}`;
      await processCommandLine(argv);
      expectBisectCalledOnceWith(expected);
    });

    it('handles a --fiddle option that is unrecognizable', async () => {
      const FIDDLE = '✨🤪💎';
      const argv = [...ARGV, GOOD, BAD, '--fiddle', FIDDLE];
      const consoleExpected = `Unrecognized Fiddle "${FIDDLE}"`;
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const exitExpected = 2;
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();
      await processCommandLine(argv);
      expect(ipcMainManager.send).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(consoleExpected);
      expect(exitSpy).toHaveBeenCalledWith(exitExpected);
      consoleSpy.mockReset();
      exitSpy.mockReset();
    });

    it('handles a --log-config option', async () => {
      await expectLogConfigOptionWorks([...ARGV, GOOD, BAD, '--log-config']);
    });

    describe(`watches for ${IpcEvents.TASK_DONE} events`, () => {
      async function expectDoneCausesExit(result: RunResult, exitCode: number) {
        const argv = [...ARGV, GOOD, BAD];
        (ipcMainManager.send as jest.Mock).mockImplementationOnce(() => {
          const fakeEvent = {};
          ipcMainManager.emit(IpcEvents.TASK_DONE, fakeEvent, result);
        });
        await processCommandLine(argv);
        expect(process.exit).toHaveBeenCalledWith(exitCode);
      }

      it(`exits with 0 on ${RunResult.SUCCESS}`, async () => {
        await expectDoneCausesExit(RunResult.SUCCESS, 0);
      });

      it(`exits with 1 on ${RunResult.FAILURE}`, async () => {
        await expectDoneCausesExit(RunResult.FAILURE, 1);
      });

      it(`exits with 2 on ${RunResult.INVALID}`, async () => {
        await expectDoneCausesExit(RunResult.INVALID, 2);
      });

      it('sends output messages to the console', async () => {
        const timeString = new Date().toLocaleTimeString();
        const text = 'asieoniezi';
        const expected = `[${timeString}] ${text}`;
        const spy = jest.spyOn(console, 'log').mockReturnValue();

        const fakeEvent = {};
        const entry: OutputEntry = { text, timeString };
        (ipcMainManager.send as jest.Mock).mockImplementationOnce(() => {
          ipcMainManager.emit(IpcEvents.OUTPUT_ENTRY, fakeEvent, entry);
        });

        const argv = [...ARGV, GOOD, BAD];
        await processCommandLine(argv);

        expect(spy).toHaveBeenCalledWith(expected);

        spy.mockRestore();
      });
    });
  });
});
