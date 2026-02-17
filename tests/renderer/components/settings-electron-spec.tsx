import * as React from 'react';

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { runInAction } from 'mobx';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderClassComponentWithInstanceRef } from '../../../rtl-spec/test-utils/renderClassComponentWithInstanceRef';
import {
  ElectronReleaseChannel,
  InstallState,
  RunnableVersion,
  VersionSource,
} from '../../../src/interfaces';
import { ElectronSettings } from '../../../src/renderer/components/settings-electron';
import { AppState } from '../../../src/renderer/state';
import { disableDownload } from '../../../src/renderer/utils/disable-download';
import { AppMock, StateMock, VersionsMock } from '../../mocks/mocks';

vi.mock('../../../src/renderer/utils/disable-download.ts');

// Let observer work normally so React 18 controlled inputs re-render properly

vi.mock('react-window', () => ({
  FixedSizeList: ({ children, itemCount, itemData }: any) => (
    <div data-testid="electron-versions-list">
      {Array.from({ length: itemCount }, (_, index) => {
        const Child = children;
        return <Child key={index} index={index} style={{}} data={itemData} />;
      })}
    </div>
  ),
}));

describe('ElectronSettings component', () => {
  let store: StateMock;
  let mockVersions: Record<string, RunnableVersion>;
  let mockVersionsArray: RunnableVersion[];

  beforeEach(() => {
    ({ mockVersions, mockVersionsArray } = new VersionsMock());
    ({ state: store } = window.app as unknown as AppMock);

    store.initVersions('2.0.1', { ...mockVersions });
    store.channelsToShow = [
      ElectronReleaseChannel.stable,
      ElectronReleaseChannel.beta,
    ];

    // Render all the states
    let i = 0;
    store.versionsToShow[i++].state = InstallState.installed;
    store.versionsToShow[i++].state = InstallState.downloading;
    store.versionsToShow[i++].state = InstallState.missing;
    store.versionsToShow[i++].state = InstallState.installing;
  });

  it('renders', () => {
    const spy = vi
      .spyOn(window.ElectronFiddle, 'getOldestSupportedMajor')
      .mockReturnValue(9);

    const moreVersions: RunnableVersion[] = [
      {
        source: VersionSource.local,
        state: InstallState.installed,
        version: '3.0.0',
      },
      {
        source: VersionSource.remote,
        state: InstallState.installed,
        version: '3.0.0-nightly.1',
      },
    ];

    for (const ver of moreVersions) {
      store.versions[ver.version] = ver;
      store.versionsToShow.unshift(ver);
    }

    render(<ElectronSettings appState={store as unknown as AppState} />);

    expect(screen.getByText('Electron Settings')).toBeInTheDocument();
    expect(
      screen.getByText('Update Electron Release List'),
    ).toBeInTheDocument();
    expect(screen.getByText('Delete All Downloads')).toBeInTheDocument();

    spy.mockRestore();
  });

  it('handles removing a version', async () => {
    const user = userEvent.setup();

    const localVer1: RunnableVersion = {
      state: InstallState.installed,
      version: '3.0.0-nightly.1',
      source: VersionSource.local,
    };

    const localVer2: RunnableVersion = {
      state: InstallState.installed,
      version: '3.0.0',
      source: VersionSource.local,
    };

    store.versions['3.0.0-nightly.1'] = localVer1;
    store.versions['3.0.0'] = localVer2;
    store.versionsToShow.unshift(localVer1, localVer2);

    render(<ElectronSettings appState={store as unknown as AppState} />);

    // Find the first "Remove" button in the versions table
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await user.click(removeButtons[0]);

    expect(store.removeVersion).toHaveBeenCalledTimes(1);
  });

  it('handles downloading a version', async () => {
    const user = userEvent.setup();

    const version = '3.0.0';
    const ver = {
      source: VersionSource.remote,
      state: InstallState.missing,
      version,
    };
    store.versions = { version: ver };
    store.versionsToShow = [ver];

    render(<ElectronSettings appState={store as unknown as AppState} />);

    // Find the "Download" button
    const downloadButton = screen.getByRole('button', { name: /^download$/i });
    await user.click(downloadButton);

    expect(store.downloadVersion).toHaveBeenCalledTimes(1);
  });

  it('handles missing local versions', async () => {
    const user = userEvent.setup();

    const version = '99999.0.0';
    const ver = {
      source: VersionSource.local,
      state: InstallState.missing,
      version,
    };
    store.versions = { version: ver };
    store.versionsToShow = [ver];

    render(<ElectronSettings appState={store as unknown as AppState} />);

    // For local missing versions, the button text is "Remove"
    const removeButton = screen.getByRole('button', { name: /remove/i });
    await user.click(removeButton);

    expect(store.removeVersion).toHaveBeenCalledTimes(1);
  });

  it('handles the deleteAll()', async () => {
    const user = userEvent.setup();

    render(<ElectronSettings appState={store as unknown as AppState} />);

    const deleteAllButton = screen.getByRole('button', {
      name: /delete all downloads/i,
    });
    await user.click(deleteAllButton);

    expect(store.removeVersion).toHaveBeenCalledTimes(mockVersionsArray.length);
  });

  it('handles the downloadAll()', async () => {
    const user = userEvent.setup();

    render(<ElectronSettings appState={store as unknown as AppState} />);

    const downloadAllButton = screen.getByRole('button', {
      name: /download all versions/i,
    });
    await user.click(downloadAllButton);

    expect(store.downloadVersion).toHaveBeenCalled();
    expect(store.downloadVersion).toHaveBeenCalledTimes(
      store.versionsToShow.length,
    );
  });

  it('handles stopDownloadingAll() during downloadAll()', async () => {
    const versionsToShowCount = store.versionsToShow.length;

    let completedDownloadCount = 0;

    const { instance } = renderClassComponentWithInstanceRef(ElectronSettings, {
      appState: store as unknown as AppState,
    });

    // Set up download mock
    store.downloadVersion.mockImplementation(async () => {
      completedDownloadCount++;
      if (completedDownloadCount >= versionsToShowCount - 2) {
        // Stop downloads before all versions downloaded
        await instance.handleStopDownloads();
      }
    });

    // Initiate download for all versions
    await instance.handleDownloadAll();

    // Stops downloading more versions
    expect(completedDownloadCount).toBeGreaterThan(1);
    expect(completedDownloadCount).toBeLessThan(versionsToShowCount);
  });

  describe('handleUpdateElectronVersions()', () => {
    it('kicks off an update of Electron versions', async () => {
      const user = userEvent.setup();

      render(<ElectronSettings appState={store as unknown as AppState} />);

      const updateButton = screen.getByRole('button', {
        name: /update electron release list/i,
      });
      await user.click(updateButton);

      expect(store.updateElectronVersions).toHaveBeenCalled();
    });
  });

  describe('handleAddVersion()', () => {
    it('toggles the add version dialog', async () => {
      const user = userEvent.setup();

      render(<ElectronSettings appState={store as unknown as AppState} />);

      const addButton = screen.getByRole('button', {
        name: /add local electron build/i,
      });
      await user.click(addButton);

      expect(store.toggleAddVersionDialog).toHaveBeenCalled();
    });
  });

  describe('handleStateChange()', () => {
    it('toggles remote versions', async () => {
      const user = userEvent.setup();

      render(<ElectronSettings appState={store as unknown as AppState} />);

      const checkbox = screen.getByLabelText('Show not downloaded versions');

      // Click to check
      await user.click(checkbox);
      expect(store.showUndownloadedVersions).toBe(true);

      // Click to uncheck
      await user.click(checkbox);
      expect(store.showUndownloadedVersions).toBe(false);
    });
  });

  describe('handleShowObsoleteChange()', () => {
    it('toggles obsolete versions', async () => {
      const user = userEvent.setup();

      render(<ElectronSettings appState={store as unknown as AppState} />);

      const checkbox = screen.getByLabelText('Show obsolete versions');

      // Click to check
      await user.click(checkbox);
      expect(store.showObsoleteVersions).toBe(true);

      // Click to uncheck
      await user.click(checkbox);
      expect(store.showObsoleteVersions).toBe(false);
    });
  });

  describe('handleChannelChange()', () => {
    it('handles a new selection', async () => {
      const user = userEvent.setup();

      // Use a beta version so Stable checkbox is not disabled
      store.version = '2.0.1-beta.1';

      store.showChannels.mockImplementation((ids: ElectronReleaseChannel[]) =>
        runInAction(() => store.channelsToShow.push(...ids)),
      );
      store.hideChannels.mockImplementation((ids: ElectronReleaseChannel[]) =>
        runInAction(() => {
          for (const id of ids) {
            const idx = store.channelsToShow.indexOf(id);
            if (idx !== -1) store.channelsToShow.splice(idx, 1);
          }
        }),
      );

      render(<ElectronSettings appState={store as unknown as AppState} />);

      // Uncheck stable
      const stableCheckbox = screen.getByLabelText(
        ElectronReleaseChannel.stable,
      );
      await user.click(stableCheckbox);

      // Check nightly
      const nightlyCheckbox = screen.getByLabelText(
        ElectronReleaseChannel.nightly,
      );
      await user.click(nightlyCheckbox);

      expect(store.channelsToShow).toEqual([
        ElectronReleaseChannel.beta,
        ElectronReleaseChannel.nightly,
      ]);
    });
  });

  describe('disableDownload()', () => {
    it('disables download buttons where return values are true', () => {
      vi.mocked(disableDownload).mockReturnValue(true);

      const version = '3.0.0';
      const ver = {
        source: VersionSource.remote,
        state: InstallState.missing,
        version,
      };

      store.versions = { version: ver };
      store.versionsToShow = [ver];

      const { container } = render(
        <ElectronSettings appState={store as unknown as AppState} />,
      );

      const disabledVersions = container.querySelectorAll('.disabled-version');
      expect(disabledVersions).toHaveLength(1);
      expect(disabledVersions[0]).toHaveClass('bp3-disabled');
    });
  });
});
