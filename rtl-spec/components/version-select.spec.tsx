import * as React from 'react';

import { render } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  InstallState,
  RunnableVersion,
  VersionSource,
} from '../../src/interfaces';
import {
  VersionSelect,
  filterItems,
  getItemDisplayText,
  getItemIcon,
  getItemLabel,
  renderItem,
} from '../../src/renderer/components/version-select';
import { disableDownload } from '../../src/renderer/utils/disable-download';
import { mockVersion1, prepareAppState } from '../test-utils/versions';

const { downloading, installed, missing, installing } = InstallState;
const { local } = VersionSource;

vi.mock('../../src/renderer/utils/disable-download.ts');

describe('VersionSelect component', () => {
  function renderVersionSelect() {
    const appState = prepareAppState();

    return render(
      <VersionSelect
        appState={appState}
        currentVersion={mockVersion1}
        onVersionSelect={vi.fn()}
      />,
    );
  }

  describe('renderItem()', () => {
    it('returns null if it does not match predicate', () => {
      const item = renderItem(mockVersion1, {
        handleClick: () => ({}),
        index: 0,
        modifiers: { active: true, disabled: false, matchesPredicate: false },
        query: '',
      });

      expect(item).toBe(null);
    });
  });

  describe('disableDownload', () => {
    it('disables download buttons when return value is true', () => {
      vi.mocked(disableDownload).mockReturnValueOnce(true);

      const item = renderItem(mockVersion1, {
        handleClick: () => ({}),
        index: 0,
        modifiers: { active: true, disabled: false, matchesPredicate: true },
        query: '',
      })!;

      const { getAllByTestId } = render(item);

      expect(getAllByTestId('disabled-menu-item')).toHaveLength(1);
    });

    it('does not disable enabled download buttons when return value is false', () => {
      vi.mocked(disableDownload).mockReturnValueOnce(false);

      const item = renderItem(mockVersion1, {
        handleClick: () => ({}),
        index: 0,
        modifiers: { active: true, disabled: false, matchesPredicate: true },
        query: '',
      })!;

      const { queryAllByTestId } = render(item);

      expect(queryAllByTestId('disabled-menu-item')).toHaveLength(0);
    });
    it('does not disable local versions even when disableDownload returns true', () => {
      vi.mocked(disableDownload).mockReturnValueOnce(true);

      const localVersion: RunnableVersion = {
        ...mockVersion1,
        source: local,
        state: installed,
        name: 'My Build',
      };

      const item = renderItem(localVersion, {
        handleClick: () => ({}),
        index: 0,
        modifiers: { active: true, disabled: false, matchesPredicate: true },
        query: '',
      })!;

      const { queryAllByTestId } = render(item);

      expect(queryAllByTestId('disabled-menu-item')).toHaveLength(0);
    });
  });

  describe('getItemDisplayText()', () => {
    it('returns name for local versions', () => {
      const input: RunnableVersion = {
        ...mockVersion1,
        source: local,
        state: installed,
        name: 'My Debug Build',
      };
      expect(getItemDisplayText(input)).toBe('My Debug Build');
    });

    it('returns "Local Build" for local versions without a name', () => {
      const input: RunnableVersion = {
        ...mockVersion1,
        source: local,
        state: installed,
      };
      expect(getItemDisplayText(input)).toBe('Local Build');
    });

    it('returns version string for remote versions', () => {
      expect(getItemDisplayText(mockVersion1)).toBe(mockVersion1.version);
    });
    it('returns the correct label for an available local version', () => {
      const input: RunnableVersion = {
        ...mockVersion1,
        state: installed,
        source: local,
      };

      expect(getItemLabel(input)).toBe('Local Build');
    });

    it('returns the correct label for an unavailable local version', () => {
      const input: RunnableVersion = {
        ...mockVersion1,
        state: missing,
        source: local,
      };

      expect(getItemLabel(input)).toBe('Unavailable');
    });

    it('returns the correct label for a version not downloaded', () => {
      const input: RunnableVersion = {
        ...mockVersion1,
        state: missing,
      };

      expect(getItemLabel(input)).toBe('Not Downloaded');
    });

    it('returns the correct label for a version downloaded', () => {
      const input: RunnableVersion = {
        ...mockVersion1,
        state: installed,
      };

      expect(getItemLabel(input)).toBe('Downloaded');
    });

    it('returns the correct label for a version downloading', () => {
      const input: RunnableVersion = {
        ...mockVersion1,
        state: downloading,
      };

      expect(getItemLabel(input)).toBe('Downloading');
    });
  });

  describe('getItemIcon()', () => {
    it('returns the correct icon', () => {
      const icons: Array<{ state: InstallState; expected: string }> = [
        { state: downloading, expected: 'cloud-download' },
        { state: installed, expected: 'saved' },
        { state: missing, expected: 'cloud' },
        { state: installing, expected: 'compressed' },
      ];
      icons.forEach(({ state, expected }) => {
        expect(getItemIcon({ ...mockVersion1, state })).toBe(expected);
      });
    });
  });

  describe('filterItems()', () => {
    it('correctly matches a numeric query', () => {
      const versions = [
        { version: '14.3.0' },
        { version: '3.0.0' },
        { version: '13.2.0' },
        { version: '12.0.0-nightly.20210301' },
        { version: '12.0.0-beta.3' },
      ] as RunnableVersion[];

      const expected = [
        { version: '3.0.0' },
        { version: '13.2.0' },
        { version: '14.3.0' },
        { version: '12.0.0-beta.3' },
        { version: '12.0.0-nightly.20210301' },
      ] as RunnableVersion[];

      expect(filterItems('3', versions)).toEqual(expected);
    });

    it('sorts local versions before remote versions', () => {
      const localVer = {
        version: '0.0.0-local.123',
        source: local,
        name: 'My Build',
      } as RunnableVersion;

      const versions = [
        { version: '14.3.0' },
        localVer,
        { version: '3.0.0' },
      ] as RunnableVersion[];

      const result = filterItems('build', versions);
      // Only the local version matches 'build' (via name)
      expect(result).toEqual([localVer]);
    });

    it('matches local versions by name', () => {
      const localVer = {
        version: '0.0.0-local.123',
        source: local,
        name: 'My Debug Build',
      } as RunnableVersion;

      const versions = [
        { version: '14.3.0' },
        localVer,
        { version: '3.0.0' },
      ] as RunnableVersion[];

      const result = filterItems('debug', versions);
      expect(result).toEqual([localVer]);
    });

    it('sorts in descending order when the query is non-numeric', () => {
      const versions = [
        { version: '3.0.0' },
        { version: '13.2.0' },
        { version: '14.3.0' },
        { version: '12.0.0-beta.3' },
        { version: '3.0.0-nightly.12345678' },
        { version: '13.2.0-nightly.12345678' },
        { version: '14.3.0-nightly.12345678' },
        { version: '9.0.0-nightly.12345678' },
        { version: '12.0.0-nightly.20210301' },
      ] as RunnableVersion[];

      const expected = [
        { version: '14.3.0-nightly.12345678' },
        { version: '13.2.0-nightly.12345678' },
        { version: '12.0.0-nightly.20210301' },
        { version: '9.0.0-nightly.12345678' },
        { version: '3.0.0-nightly.12345678' },
      ] as RunnableVersion[];

      expect(filterItems('nightly', versions)).toEqual(expected);
    });
  });

  describe('renderVersionContextMenu()', () => {
    it('copies the current version number to the clipboard', async () => {
      const spy = vi
        .spyOn(navigator.clipboard, 'writeText')
        .mockImplementationOnce(vi.fn());

      const { getByRole, getByText } = renderVersionSelect();

      await userEvent.pointer({
        keys: '[MouseRight]',
        target: getByRole('button'),
      });

      await userEvent.click(getByText(/copy version number/i));

      expect(spy).toHaveBeenCalledWith(mockVersion1.version);
    });
  });
});
