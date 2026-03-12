import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ElectronReleaseChannel,
  InstallState,
  RunResult,
  VersionSource,
} from '../../src/interfaces';
import { Bisector } from '../../src/renderer/bisect';
import { BisectDialog } from '../../src/renderer/components/dialog-bisect';
import { Runner } from '../../src/renderer/runner';
import { AppState } from '../../src/renderer/state';
import { StateMock } from '../../tests/mocks/mocks';
import { renderClassComponentWithInstanceRef } from '../test-utils/renderClassComponentWithInstanceRef';

vi.mock('../../src/renderer/bisect');

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
    store.isBisectDialogShowing = true;

    vi.mocked(Bisector).mockClear();
  });

  function renderBisectDialog() {
    return renderClassComponentWithInstanceRef(BisectDialog, {
      appState: store,
    });
  }

  it('renders the dialog when open', () => {
    renderBisectDialog();

    expect(screen.getByText('Start a bisect session')).toBeInTheDocument();
    expect(
      screen.getByText(/Earliest Version \(Last "known good" version\)/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Latest Version \(First "known bad" version\)/),
    ).toBeInTheDocument();
  });

  it('renders the help section', () => {
    renderBisectDialog();

    expect(
      screen.getByText(/A "bisect" is a popular method/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /show help/i }),
    ).toBeInTheDocument();
  });

  it('shows expanded help when Show help button is clicked', () => {
    const { instance } = renderBisectDialog();

    const helpButton = screen.getByRole('button', { name: /show help/i });
    fireEvent.click(helpButton);

    expect(instance.state.showHelp).toBe(true);
    expect(
      screen.getByText(/First, write a fiddle that reproduces/),
    ).toBeInTheDocument();
  });

  it('renders Begin, Auto, and Cancel buttons', () => {
    renderBisectDialog();

    expect(screen.getByRole('button', { name: /begin/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /auto/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('Cancel button closes dialog', () => {
    renderBisectDialog();

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(store.isBisectDialogShowing).toBe(false);
  });

  describe('onBeginSelect()', () => {
    it('sets the begin version', () => {
      const { instance } = renderBisectDialog();

      expect(instance.state.startIndex).toBe(
        numVersions > 10 ? 10 : numVersions - 1,
      );
      instance.onBeginSelect(store.versionsToShow[2]);
      expect(instance.state.startIndex).toBe(2);
    });
  });

  describe('onEndSelect()', () => {
    it('sets the end version', () => {
      const { instance } = renderBisectDialog();

      expect(instance.state.endIndex).toBe(0);
      instance.onEndSelect(store.versionsToShow[2]);
      expect(instance.state.endIndex).toBe(2);
    });
  });

  describe('onSubmit()', () => {
    it('initiates a bisect instance and sets a version', async () => {
      const version = '1.0.0';
      vi.mocked(Bisector).mockReturnValue({
        getCurrentVersion: () => ({ version }),
      } as any);

      const versions = generateVersionRange(numVersions);

      const { instance } = renderBisectDialog();
      instance.setState({
        allVersions: versions,
        endIndex: 0,
        startIndex: versions.length - 1,
      });

      await instance.onSubmit();

      expect(Bisector).toHaveBeenCalledWith(versions.reverse());
      expect(store.Bisector).toBeDefined();
      expect(store.setVersion).toHaveBeenCalledWith(version);
    });

    it('does nothing if range is invalid (endIndex > startIndex)', async () => {
      const { instance } = renderBisectDialog();

      // Set invalid range where end > start
      instance.setState({
        startIndex: 0,
        endIndex: 4,
      });

      await instance.onSubmit();
      expect(Bisector).not.toHaveBeenCalled();
    });
  });

  describe('onAuto()', () => {
    it('initiates autobisect', async () => {
      const { instance } = renderBisectDialog();
      instance.setState({
        allVersions: generateVersionRange(numVersions),
        endIndex: 0,
        startIndex: 4,
      });

      vi.mocked(runner.autobisect).mockResolvedValue(RunResult.SUCCESS);

      await instance.onAuto();

      expect(runner.autobisect).toHaveBeenCalled();
    });

    it('does nothing if range is invalid (endIndex > startIndex)', async () => {
      const { instance } = renderBisectDialog();

      // Set invalid range where end > start
      instance.setState({
        startIndex: 0,
        endIndex: 4,
      });

      await instance.onAuto();
      expect(runner.autobisect).not.toHaveBeenCalled();
    });
  });

  describe('items disabled', () => {
    let instance: InstanceType<typeof BisectDialog>;

    beforeEach(() => {
      ({ instance } = renderBisectDialog());
    });

    describe('isEarliestItemDisabled', () => {
      const endIndex = 2;

      it('enables a version older than the "latest version"', () => {
        instance.setState({ endIndex });
        expect(
          instance.isEarliestItemDisabled(store.versionsToShow[endIndex + 1]),
        ).toBeFalsy();
      });

      it('disables a version newer than the "latest version"', () => {
        instance.setState({ endIndex });
        expect(
          instance.isEarliestItemDisabled(store.versionsToShow[endIndex - 1]),
        ).toBeTruthy();
      });
    });

    describe('isLatestItemDisabled', () => {
      const startIndex = 2;

      it('enables a version newer than the "earliest version"', () => {
        instance.setState({ startIndex });
        expect(
          instance.isLatestItemDisabled(store.versionsToShow[startIndex - 1]),
        ).toBeFalsy();
      });

      it('disables a version older than the "earliest version"', () => {
        instance.setState({ startIndex });
        expect(
          instance.isLatestItemDisabled(store.versionsToShow[startIndex + 1]),
        ).toBeTruthy();
      });
    });
  });

  describe('canSubmit', () => {
    it('returns true when startIndex > endIndex', () => {
      const { instance } = renderBisectDialog();
      instance.setState({ startIndex: 3, endIndex: 0 });
      expect(instance.canSubmit).toBe(true);
    });

    it('returns false when startIndex <= endIndex', () => {
      const { instance } = renderBisectDialog();
      instance.setState({ startIndex: 0, endIndex: 3 });
      expect(instance.canSubmit).toBe(false);
    });
  });

  describe('button states', () => {
    it('disables Begin and Auto when selection is invalid', async () => {
      const { instance } = renderBisectDialog();

      instance.setState({ startIndex: 0, endIndex: 3 });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /begin/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /auto/i })).toBeDisabled();
      });
    });

    it('enables Begin and Auto when selection is valid', async () => {
      const { instance } = renderBisectDialog();

      instance.setState({ startIndex: 4, endIndex: 0 });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /begin/i }),
        ).not.toBeDisabled();
        expect(
          screen.getByRole('button', { name: /auto/i }),
        ).not.toBeDisabled();
      });
    });
  });
});
