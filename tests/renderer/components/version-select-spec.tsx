import { shallow } from 'enzyme';
import * as React from 'react';

import {
  ElectronReleaseChannel,
  RunnableVersion,
  VersionSource,
  VersionState,
} from '../../../src/interfaces';
import {
  filterItem,
  getItemIcon,
  getItemLabel,
  renderItem,
  VersionSelect,
} from '../../../src/renderer/components/version-select';

import { StateMock, VersionsMock } from '../../mocks/mocks';

const { downloading, ready, unknown, unzipping } = VersionState;
const { remote, local } = VersionSource;

describe('VersionSelect component', () => {
  let store: StateMock;

  const mockVersion1 = {
    source: remote,
    state: unknown,
    version: '1.0.0',
  };

  const mockVersion2 = {
    source: remote,
    state: unknown,
    version: '3.0.0-unsupported',
  };

  beforeEach(() => {
    ({ state: store } = (window as any).ElectronFiddle.app);

    const { mockVersions } = new VersionsMock();
    store.initVersions('2.0.2', {
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
        appState={store as any}
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
        state: unknown,
      };

      expect(getItemLabel(input)).toBe('Not downloaded');
    });

    it('returns the correct label for a version downloaded', () => {
      const input: RunnableVersion = {
        ...mockVersion1,
        state: ready,
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
      const icons: Array<{ state: VersionState; expected: string }> = [
        { state: downloading, expected: 'cloud-download' },
        { state: ready, expected: 'saved' },
        { state: unknown, expected: 'cloud' },
        { state: unzipping, expected: 'compressed' },
      ];
      icons.forEach(({ state, expected }) => {
        expect(getItemIcon({ ...mockVersion1, state })).toBe(expected);
      });
    });
  });

  describe('filterItem()', () => {
    it('correctly matches a query', () => {
      expect(filterItem('test', mockVersion1)).toBe(false);
      expect(filterItem('1.0.0', mockVersion1)).toBe(true);
    });
  });
});
