import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderClassComponentWithInstanceRef } from '../../../rtl-spec/test-utils/renderClassComponentWithInstanceRef';
import {
  ElectronReleaseChannel,
  InstallState,
  RunResult,
  VersionSource,
} from '../../../src/interfaces';
import { Bisector } from '../../../src/renderer/bisect';
import { BisectDialog } from '../../../src/renderer/components/dialog-bisect';
import { Runner } from '../../../src/renderer/runner';
import { AppState } from '../../../src/renderer/state';
import { StateMock } from '../../mocks/mocks';

vi.mock('../../../src/renderer/bisect');

describe.each([8, 15])('BisectDialog component', (numVersions) => {
  let runner: Runner;
  let store: AppState;

  const generateVersionRange = (rangeLength: number) =>
    new Array(rangeLength).fill(0).map((_, i) => ({
      state: InstallState.installed,
      version: `${i + 1}.0.0`,
      source: VersionSource.local,
    }));

  beforeEach(() => {
    ({ runner, state: store } = window.app);

    (store as unknown as StateMock).versionsToShow =
      generateVersionRange(numVersions);
    (store as unknown as StateMock).versions = Object.fromEntries(
      store.versionsToShow.map((ver) => [ver.version, ver]),
    );
    (store as unknown as StateMock).channelsToShow = [
      ElectronReleaseChannel.stable,
    ];
  });

  it('renders', () => {
    store.isBisectDialogShowing = true;
    const { instance } = renderClassComponentWithInstanceRef(BisectDialog, {
      appState: store,
    });

    act(() => {
      (instance as any).setState({
        startIndex: 3,
        endIndex: 0,
        allVersions: generateVersionRange(numVersions),
      });
    });
    expect(screen.getByText('Start a bisect session')).toBeInTheDocument();
    expect(screen.getByText('Begin')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders with incorrect order', () => {
    store.isBisectDialogShowing = true;
    const { instance } = renderClassComponentWithInstanceRef(BisectDialog, {
      appState: store,
    });

    // Incorrect order (startIndex < endIndex)
    act(() => {
      (instance as any).setState({
        startIndex: 3,
        endIndex: 4,
        allVersions: generateVersionRange(numVersions),
      });
    });
    expect(screen.getByText('Start a bisect session')).toBeInTheDocument();
    // Begin button should be disabled in this case
    expect(screen.getByRole('button', { name: /Begin/ })).toBeDisabled();
  });

  it('renders with help displayed', () => {
    store.isBisectDialogShowing = true;
    const { instance } = renderClassComponentWithInstanceRef(BisectDialog, {
      appState: store,
    });

    act(() => {
      (instance as any).showHelp();
    });
    expect(
      screen.getByText(/First, write a fiddle that reproduces a bug/),
    ).toBeInTheDocument();
  });

  describe('onBeginSelect()', () => {
    it('sets the begin version', () => {
      store.isBisectDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(BisectDialog, {
        appState: store,
      });

      expect((instance as any).state.startIndex).toBe(
        numVersions > 10 ? 10 : numVersions - 1,
      );
      act(() => {
        (instance as any).onBeginSelect(store.versionsToShow[2]);
      });
      expect((instance as any).state.startIndex).toBe(2);
    });
  });

  describe('onEndSelect()', () => {
    it('sets the end version', () => {
      store.isBisectDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(BisectDialog, {
        appState: store,
      });

      expect((instance as any).state.endIndex).toBe(0);
      act(() => {
        (instance as any).onEndSelect(store.versionsToShow[2]);
      });
      expect((instance as any).state.endIndex).toBe(2);
    });
  });

  describe('onSubmit()', () => {
    it('initiates a bisect instance and sets a version', async () => {
      const version = '1.0.0';
      vi.mocked(Bisector).mockReturnValue({
        getCurrentVersion: () => ({ version }),
      } as any);

      const versions = generateVersionRange(numVersions);

      store.isBisectDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(BisectDialog, {
        appState: store,
      });
      act(() => {
        (instance as any).setState({
          allVersions: versions,
          endIndex: 0,
          startIndex: versions.length - 1,
        });
      });

      await act(async () => {
        await (instance as any).onSubmit();
      });
      expect(Bisector).toHaveBeenCalledWith(versions.reverse());
      expect(store.Bisector).toBeDefined();
      expect(store.setVersion).toHaveBeenCalledWith(version);
    });

    it('does nothing if endIndex or startIndex are falsy', async () => {
      store.isBisectDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(BisectDialog, {
        appState: store,
      });

      // Call onSubmit directly after modifying state via the private field
      // (setState with undefined indices would crash VersionSelect in full render)
      const origState = { ...(instance as any).state };
      (instance as any).state = {
        ...origState,
        startIndex: undefined,
        endIndex: 0,
      };
      await (instance as any).onSubmit();
      expect(Bisector).not.toHaveBeenCalled();

      (instance as any).state = {
        ...origState,
        startIndex: 4,
        endIndex: undefined,
      };
      await (instance as any).onSubmit();
      expect(Bisector).not.toHaveBeenCalled();

      // Restore valid state for clean teardown
      (instance as any).state = origState;
    });
  });

  describe('onAuto()', () => {
    it('initiates autobisect', async () => {
      // setup: dialog state
      store.isBisectDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(BisectDialog, {
        appState: store,
      });
      act(() => {
        (instance as any).setState({
          allVersions: generateVersionRange(numVersions),
          endIndex: 0,
          startIndex: 4,
        });
      });

      vi.mocked(runner.autobisect).mockResolvedValue(RunResult.SUCCESS);

      // click the 'auto' button
      await act(async () => {
        await (instance as any).onAuto();
      });

      // check the results
      expect(runner.autobisect).toHaveBeenCalled();
    });

    it('does nothing if endIndex or startIndex are falsy', async () => {
      store.isBisectDialogShowing = true;
      const { instance } = renderClassComponentWithInstanceRef(BisectDialog, {
        appState: store,
      });

      // Directly modify state to avoid re-render crash with undefined indices
      const origState = { ...(instance as any).state };
      (instance as any).state = {
        ...origState,
        startIndex: undefined,
        endIndex: 0,
      };
      await (instance as any).onAuto();
      expect(Bisector).not.toHaveBeenCalled();

      (instance as any).state = {
        ...origState,
        startIndex: 4,
        endIndex: undefined,
      };
      await (instance as any).onAuto();
      expect(Bisector).not.toHaveBeenCalled();

      // Restore valid state for clean teardown
      (instance as any).state = origState;
    });
  });

  describe('items disabled', () => {
    let instance: any;

    beforeEach(() => {
      store.isBisectDialogShowing = true;
      ({ instance } = renderClassComponentWithInstanceRef(BisectDialog, {
        appState: store,
      }));
    });

    describe('isEarliestItemDisabled', () => {
      const endIndex = 2;

      it('enables a version older than the "latest version"', () => {
        act(() => {
          instance.setState({ endIndex });
        });
        expect(
          instance.isEarliestItemDisabled(store.versionsToShow[endIndex + 1]),
        ).toBeFalsy();
      });

      it('disables a version newer than the "latest version"', () => {
        act(() => {
          instance.setState({ endIndex });
        });
        expect(
          instance.isEarliestItemDisabled(store.versionsToShow[endIndex - 1]),
        ).toBeTruthy();
      });
    });

    describe('isLatestItemDisabled', () => {
      const startIndex = 2;

      it('enables a version newer than the "earliest version"', () => {
        act(() => {
          instance.setState({ startIndex });
        });
        expect(
          instance.isLatestItemDisabled(store.versionsToShow[startIndex - 1]),
        ).toBeFalsy();
      });

      it('disables a version older than the "earliest version"', () => {
        act(() => {
          instance.setState({ startIndex });
        });
        expect(
          instance.isLatestItemDisabled(store.versionsToShow[startIndex + 1]),
        ).toBeTruthy();
      });
    });
  });
});
