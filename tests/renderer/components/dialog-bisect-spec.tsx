import { shallow } from 'enzyme';
import * as React from 'react';
import {
  ElectronReleaseChannel,
  RunResult,
  VersionSource,
  VersionState,
} from '../../../src/interfaces';
import { Bisector } from '../../../src/renderer/bisect';
import { BisectDialog } from '../../../src/renderer/components/dialog-bisect';

import { RunnerMock, StateMock } from '../../mocks/mocks';

jest.mock('../../../src/renderer/bisect');

describe('BisectDialog component', () => {
  const NUM_VERSIONS = 10;
  let runner: RunnerMock;
  let store: StateMock;

  const generateVersionRange = (rangeLength: number) =>
    new Array(rangeLength).fill(0).map((_, i) => ({
      state: VersionState.ready,
      version: `${i + 1}.0.0`,
      source: VersionSource.local,
    }));

  beforeEach(() => {
    ({ runner, state: store } = (window as any).ElectronFiddle.app);

    store.versionsToShow = generateVersionRange(NUM_VERSIONS);
    store.versions = Object.fromEntries(
      store.versionsToShow.map((ver) => [ver.version, ver]),
    );
    store.channelsToShow = [ElectronReleaseChannel.stable];
  });

  it('renders', () => {
    const wrapper = shallow(<BisectDialog appState={store as any} />);
    // start and end selected
    wrapper.setState({
      startIndex: 3,
      endIndex: 0,
      allVersions: generateVersionRange(NUM_VERSIONS),
    });
    expect(wrapper).toMatchSnapshot();

    // no selection
    wrapper.setState({
      startIndex: undefined,
      endIndex: undefined,
      allVersions: generateVersionRange(NUM_VERSIONS),
    });
    expect(wrapper).toMatchSnapshot();

    // only start selected
    wrapper.setState({
      startIndex: 3,
      endIndex: undefined,
      allVersions: generateVersionRange(NUM_VERSIONS),
    });
    expect(wrapper).toMatchSnapshot();

    // Incorrect order
    wrapper.setState({
      startIndex: 3,
      endIndex: 4,
      allVersions: generateVersionRange(NUM_VERSIONS),
    });
    expect(wrapper).toMatchSnapshot();

    // Help displayed
    (wrapper.instance() as any).showHelp();
    expect(wrapper).toMatchSnapshot();
  });

  describe('onBeginSelect()', () => {
    it('sets the begin version', () => {
      const wrapper = shallow(<BisectDialog appState={store as any} />);
      const instance: BisectDialog = wrapper.instance() as any;

      expect(instance.state.startIndex).toBe(NUM_VERSIONS);
      instance.onBeginSelect(store.versionsToShow[2]);
      expect(instance.state.startIndex).toBe(2);
    });
  });

  describe('onEndSelect()', () => {
    it('sets the end version', () => {
      const wrapper = shallow(<BisectDialog appState={store as any} />);
      const instance: BisectDialog = wrapper.instance() as any;

      expect(instance.state.endIndex).toBe(0);
      instance.onEndSelect(store.versionsToShow[2]);
      expect(instance.state.endIndex).toBe(2);
    });
  });

  describe('onSubmit()', () => {
    it('initiates a bisect instance and sets a version', async () => {
      const version = '1.0.0';
      (Bisector as jest.Mock).mockReturnValue({
        getCurrentVersion: () => ({ version }),
      });

      const versions = generateVersionRange(NUM_VERSIONS);

      const wrapper = shallow(<BisectDialog appState={store as any} />);
      wrapper.setState({
        allVersions: versions,
        endIndex: 0,
        startIndex: versions.length - 1,
      });

      const instance: BisectDialog = wrapper.instance() as any;
      await instance.onSubmit();
      expect(Bisector).toHaveBeenCalledWith(versions.reverse());
      expect(store.Bisector).toBeDefined();
      expect(store.setVersion).toHaveBeenCalledWith(version);
    });

    it('does nothing if endIndex or startIndex are falsy', async () => {
      const wrapper = shallow(<BisectDialog appState={store as any} />);

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

  describe('onAuto()', () => {
    it('initiates autobisect', async () => {
      // setup: dialog state
      const wrapper = shallow(<BisectDialog appState={store as any} />);
      wrapper.setState({
        allVersions: generateVersionRange(NUM_VERSIONS),
        endIndex: 0,
        startIndex: 4,
      });

      runner.autobisect.mockResolvedValue(RunResult.SUCCESS);

      // click the 'auto' button
      const instance1: BisectDialog = wrapper.instance() as any;
      await instance1.onAuto();

      // check the results
      expect(runner.autobisect).toHaveBeenCalled();
    });

    it('does nothing if endIndex or startIndex are falsy', async () => {
      const wrapper = shallow(<BisectDialog appState={store as any} />);

      wrapper.setState({
        startIndex: undefined,
        endIndex: 0,
      });
      const instance1: BisectDialog = wrapper.instance() as any;
      await instance1.onAuto();
      expect(Bisector).not.toHaveBeenCalled();

      wrapper.setState({
        startIndex: 4,
        endIndex: undefined,
      });

      const instance2: BisectDialog = wrapper.instance() as any;
      await instance2.onAuto();
      expect(Bisector).not.toHaveBeenCalled();
    });
  });

  describe('items disabled', () => {
    let instance: BisectDialog;

    beforeEach(() => {
      const wrapper = shallow(<BisectDialog appState={store as any} />);
      instance = wrapper.instance() as any;
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
});
