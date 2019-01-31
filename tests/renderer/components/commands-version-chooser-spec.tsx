import { shallow } from 'enzyme';
import * as React from 'react';

import { ElectronVersion, ElectronVersionSource, ElectronVersionState } from '../../../src/interfaces';
import { filterItem, getItemIcon, getItemLabel, renderItem, VersionChooser } from '../../../src/renderer/components/commands-version-chooser';
import { ElectronReleaseChannel } from '../../../src/renderer/versions';
import { mockVersions } from '../../mocks/electron-versions';

const { ready, unknown, downloading } = ElectronVersionState;
const { remote, local } = ElectronVersionSource;

describe('VersionChooser component', () => {
  let store: any;

  const mockVersion1 = {
    source: remote,
    state: unknown,
    version: '1.0.0'
  };

  const mockVersion2 = {
    source: remote,
    state: unknown,
    version: '3.0.0-unsupported'
  };

  beforeEach(() => {
    store = {
      version: '2.0.2',
      versions: {
        ...mockVersions,
        '3.1.3': undefined,
        '1.0.0': { ...mockVersion1 },
        '3.0.0-unsupported': { ...mockVersion2 }
      },
      versionsToShow: [ ElectronReleaseChannel.stable, ElectronReleaseChannel.beta ],
      statesToShow: [ ElectronVersionState.ready, ElectronVersionState.downloading ],
      setVersion: jest.fn(),
      get currentElectronVersion() {
        return mockVersions['2.0.2'];
      }
    };
  });

  it('renders', () => {
    const wrapper = shallow(<VersionChooser appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('handles a change appropriately', () => {
    const wrapper = shallow(<VersionChooser appState={store} />);
    const instance: VersionChooser = wrapper.instance() as any;

    instance.onItemSelect({ version: 'v2.0.1' } as any);

    expect(store.setVersion).toHaveBeenCalledWith('v2.0.1');
  });

  it('handles corrupt data', () => {
    store.version = 'blub';

    const wrapper = shallow(<VersionChooser appState={store} />);

    expect(wrapper).toMatchSnapshot();
    expect(wrapper.html()).toContain('Electron v2.0.2');
  });

  describe('renderItem()', () => {
    it('renders an item', () => {
      const item = renderItem(mockVersion1, {
        handleClick: () => ({}),
        index: 0,
        modifiers: { active: true, disabled: false, matchesPredicate: true },
        query: ''
      });

      expect(item).toMatchSnapshot();
    });

    it('returns null if it does not match predicate', () => {
      const item = renderItem(mockVersion1, {
        handleClick: () => ({}),
        index: 0,
        modifiers: { active: true, disabled: false, matchesPredicate: false },
        query: ''
      });

      expect(item).toBe(null);
    });
  });

  describe('getItemLabel()', () => {
    it('returns the correct label for a local version', () => {
      const input: ElectronVersion = {
        ...mockVersion1,
        source: local,
      };

      expect(getItemLabel(input)).toBe('Local');
      expect(getItemLabel({ ...input, name: 'Hi' })).toBe('Hi');
    });

    it('returns the correct label for a version not downloaded', () => {
      const input: ElectronVersion = {
        ...mockVersion1,
        state: unknown
      };

      expect(getItemLabel(input)).toBe('Not downloaded');
    });

    it('returns the correct label for a version downloaded', () => {
      const input: ElectronVersion = {
        ...mockVersion1,
        state: ready
      };

      expect(getItemLabel(input)).toBe('Downloaded');
    });

    it('returns the correct label for a version downloading', () => {
      const input: ElectronVersion = {
        ...mockVersion1,
        state: downloading
      };

      expect(getItemLabel(input)).toBe('Downloading');
    });
  });

  describe('getItemIcon()', () => {
    it('returns the correct icon', () => {
      const vDownloaded = { ...mockVersion1, state: ready };
      expect(getItemIcon(vDownloaded)).toBe('saved');

      const vDownloading = { ...mockVersion1, state: downloading };
      expect(getItemIcon(vDownloading)).toBe('cloud-download');

      const vUnknown = { ...mockVersion1, state: unknown };
      expect(getItemIcon(vUnknown)).toBe('cloud');
    });
  });

  describe('filterItem()', () => {
    it('correctly matches a query', () => {
      expect(filterItem('test', mockVersion1)).toBe(false);
      expect(filterItem('1.0.0', mockVersion1)).toBe(true);
    });
  });
});
