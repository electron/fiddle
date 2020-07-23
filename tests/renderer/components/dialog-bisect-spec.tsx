import { shallow } from 'enzyme';
import * as React from 'react';
import { VersionSource, VersionState } from '../../../src/interfaces';
import { Bisector } from '../../../src/renderer/bisect';
import { BisectDialog } from '../../../src/renderer/components/dialog-bisect';
import { ElectronReleaseChannel } from '../../../src/renderer/versions';

jest.mock('../../../src/renderer/bisect');

describe('BisectDialog component', () => {
  let store: any;

  const generateVersionRange = (rangeLength: number) =>
    new Array(rangeLength).fill(0).map((_, i) => ({
      state: VersionState.ready,
      version: `${i + 1}.0.0`,
      source: VersionSource.local,
    }));

  beforeEach(() => {
    const versions = generateVersionRange(5);

    store = {
      versions,
      versionsToShow: versions,
      channelsToShow: [ElectronReleaseChannel.stable],
      statesToShow: [VersionState.ready],
      setVersion: jest.fn(),
    };
  });

  it('renders', () => {
    const wrapper = shallow(<BisectDialog appState={store} />);
    // start and end selected
    wrapper.setState({
      startIndex: 3,
      endIndex: 0,
      allVersions: generateVersionRange(5),
    });
    expect(wrapper).toMatchSnapshot();

    // no selection
    wrapper.setState({
      startIndex: undefined,
      endIndex: undefined,
      allVersions: generateVersionRange(5),
    });
    expect(wrapper).toMatchSnapshot();

    // only start selected
    wrapper.setState({
      startIndex: 3,
      endIndex: undefined,
      allVersions: generateVersionRange(5),
    });
    expect(wrapper).toMatchSnapshot();

    // Incorrect order
    wrapper.setState({
      startIndex: 3,
      endIndex: 4,
      allVersions: generateVersionRange(5),
    });
    expect(wrapper).toMatchSnapshot();

    // Help displayed
    (wrapper.instance() as any).showHelp();
    expect(wrapper).toMatchSnapshot();
  });

  describe('onBeginSelect()', () => {
    it('sets the begin version', () => {
      const wrapper = shallow(<BisectDialog appState={store} />);
      const instance: BisectDialog = wrapper.instance() as any;

      expect(instance.state.startIndex).toBe(10);
      instance.onBeginSelect(store.versions[2]);
      expect(instance.state.startIndex).toBe(2);
    });
  });

  describe('onEndSelect()', () => {
    it('sets the end version', () => {
      const wrapper = shallow(<BisectDialog appState={store} />);
      const instance: BisectDialog = wrapper.instance() as any;

      expect(instance.state.endIndex).toBe(0);
      instance.onEndSelect(store.versions[2]);
      expect(instance.state.endIndex).toBe(2);
    });
  });

  describe('onSubmit()', () => {
    it('initiates a bisect instance and sets a version', async () => {
      const version = '1.0.0';
      (Bisector as jest.Mock).mockImplementation(() => {
        return {
          getCurrentVersion: () => ({ version }),
        };
      });

      const versions = generateVersionRange(5);

      const wrapper = shallow(<BisectDialog appState={store} />);
      wrapper.setState({
        startIndex: 4,
        endIndex: 0,
        allVersions: versions,
      });

      const instance: BisectDialog = wrapper.instance() as any;
      await instance.onSubmit();
      expect(Bisector).toHaveBeenCalledWith(versions.slice(0, 5).reverse());
      expect(store.Bisector).toBeDefined();
      expect(store.setVersion).toHaveBeenCalledWith(version);
    });

    it('does nothing if endIndex or startIndex are falsy', async () => {
      const wrapper = shallow(<BisectDialog appState={store} />);

      wrapper.setState({
        startIndex: undefined,
        endIndex: 0,
      });
      const instance1: BisectDialog = wrapper.instance() as any;
      await instance1.onSubmit();
      expect(Bisector).not.toHaveBeenCalled();

      wrapper.setState({
        startIndex: 4,
        endIndex: undefined,
      });

      const instance2: BisectDialog = wrapper.instance() as any;
      await instance2.onSubmit();
      expect(Bisector).not.toHaveBeenCalled();
    });
  });

  describe('items disabled', () => {
    let instance: BisectDialog;

    beforeEach(() => {
      const wrapper = shallow(<BisectDialog appState={store} />);
      instance = wrapper.instance() as any;
    });

    describe('isEarliestItemDisabled', () => {
      it('enables a version older than the "latest version"', () => {
        instance.setState({ endIndex: 2 });

        const result = instance.isEarliestItemDisabled(store.versions[3]);
        expect(result).toBeFalsy();
      });

      it('disables a version newer than the "latest version"', () => {
        instance.setState({ endIndex: 2 });

        const result = instance.isEarliestItemDisabled(store.versions[1]);
        expect(result).toBeTruthy();
      });
    });

    describe('isLatestItemDisabled', () => {
      it('enables a version newer than the "earliest version"', () => {
        instance.setState({ startIndex: 2 });

        const result = instance.isLatestItemDisabled(store.versions[1]);
        expect(result).toBeFalsy();
      });

      it('disables a version older than the "earliest version"', () => {
        instance.setState({ startIndex: 2 });

        const result = instance.isLatestItemDisabled(store.versions[4]);
        expect(result).toBeTruthy();
      });
    });
  });
});
