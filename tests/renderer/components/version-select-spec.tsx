import * as React from 'react';

import { InstallState } from '@electron/fiddle-core';
import { shallow } from 'enzyme';

import {
  ElectronReleaseChannel,
  RunnableVersion,
  VersionSource,
} from '../../../src/interfaces';
import {
  VersionSelect,
  filterItems,
  getItemIcon,
  getItemLabel,
  renderItem,
} from '../../../src/renderer/components/version-select';
import { AppState } from '../../../src/renderer/state';
import { disableDownload } from '../../../src/utils/disable-download';
import { StateMock, VersionsMock } from '../../mocks/mocks';

const { downloading, installed, missing, installing } = InstallState;
const { remote, local } = VersionSource;

jest.mock('../../../src/utils/disable-download.ts');

describe('VersionSelect component', () => {
  let store: AppState;

  const mockVersion1 = {
    source: remote,
    state: missing,
    version: '1.0.0',
  };

  const mockVersion2 = {
    source: remote,
    state: missing,
    version: '3.0.0-unsupported',
  };

  beforeEach(() => {
    ({ state: store } = window.ElectronFiddle.app);

    const { mockVersions } = new VersionsMock();
    ((store as unknown) as StateMock).initVersions('2.0.2', {
      ...mockVersions,
      '1.0.0': { ...mockVersion1 },
      '3.0.0-unsupported': { ...mockVersion2 },
    });
    store.channelsToShow = [
      ElectronReleaseChannel.stable,
      ElectronReleaseChannel.beta,
    ];
  });

  const onVersionSelect = () => ({});

  it('renders', () => {
    const wrapper = shallow(
      <VersionSelect
        appState={store}
        currentVersion={mockVersion1}
        onVersionSelect={onVersionSelect}
      />,
    );
    expect(wrapper).toMatchSnapshot();
  });

  describe('renderItem()', () => {
    it('renders an item', () => {
      const item = renderItem(mockVersion1, {
        handleClick: () => ({}),
        index: 0,
        modifiers: { active: true, disabled: false, matchesPredicate: true },
        query: '',
      });

      expect(item).toMatchSnapshot();
    });

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
      (disableDownload as jest.Mock).mockReturnValueOnce(true);

      const item = renderItem(mockVersion1, {
        handleClick: () => ({}),
        index: 0,
        modifiers: { active: true, disabled: false, matchesPredicate: true },
        query: '',
      })!;

      const ItemWrapper = shallow(item);

      expect(ItemWrapper.find('.disabled-menu-tooltip')).toHaveLength(1);
    });

    it('does not disable enabled download buttons when return value is false', () => {
      (disableDownload as jest.Mock).mockReturnValueOnce(false);

      const item = renderItem(mockVersion1, {
        handleClick: () => ({}),
        index: 0,
        modifiers: { active: true, disabled: false, matchesPredicate: true },
        query: '',
      })!;

      const ItemWrapper = shallow(item);

      expect(ItemWrapper.exists('.disabled-menu-tooltip')).toBe(false);
    });
  });

  describe('getItemLabel()', () => {
    it('returns the correct label for a local version', () => {
      const input: RunnableVersion = {
        ...mockVersion1,
        source: local,
      };

      expect(getItemLabel(input)).toBe('Local');
      expect(getItemLabel({ ...input, name: 'Hi' })).toBe('Hi');
    });

    it('returns the correct label for a version not downloaded', () => {
      const input: RunnableVersion = {
        ...mockVersion1,
        state: missing,
      };

      expect(getItemLabel(input)).toBe('Not downloaded');
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
});
