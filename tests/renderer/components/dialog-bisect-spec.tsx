import * as React from 'react';

import { InstallState } from '@electron/fiddle-core';
import { shallow } from 'enzyme';

import {
  ElectronReleaseChannel,
  RunResult,
  VersionSource,
} from '../../../src/interfaces';
import { Bisector } from '../../../src/renderer/bisect';
import { BisectDialog } from '../../../src/renderer/components/dialog-bisect';
import { Runner } from '../../../src/renderer/runner';
import { AppState } from '../../../src/renderer/state';
import { StateMock } from '../../mocks/mocks';

jest.mock('../../../src/renderer/bisect');

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
    ({ runner, state: store } = window.ElectronFiddle.app);

    ((store as unknown) as StateMock).versionsToShow = generateVersionRange(
      numVersions,
    );
    ((store as unknown) as StateMock).versions = Object.fromEntries(
      store.versionsToShow.map((ver) => [ver.version, ver]),
    );
    ((store as unknown) as StateMock).channelsToShow = [
      ElectronReleaseChannel.stable,
    ];
  });

  it('renders', () => {
    const wrapper = shallow(<BisectDialog appState={store} />);
    // start and end selected
    wrapper.setState({
      startIndex: 3,
      endIndex: 0,
      allVersions: generateVersionRange(numVersions),
    });
    expect(wrapper).toMatchSnapshot();

    // no selection
    wrapper.setState({
      startIndex: undefined,
      endIndex: undefined,
      allVersions: generateVersionRange(numVersions),
    });
    expect(wrapper).toMatchSnapshot();

    // only start selected
    wrapper.setState({
      startIndex: 3,
      endIndex: undefined,
      allVersions: generateVersionRange(numVersions),
    });
    expect(wrapper).toMatchSnapshot();

    // Incorrect order
    wrapper.setState({
      startIndex: 3,
      endIndex: 4,
      allVersions: generateVersionRange(numVersions),
    });
    expect(wrapper).toMatchSnapshot();

    // Help displayed
    (wrapper.instance() as any).showHelp();
    expect(wrapper).toMatchSnapshot();
  });

  describe('onBeginSelect()', () => {
    it('sets the begin version', () => {
      const wrapper = shallow(<BisectDialog appState={store} />);
      const instance: any = wrapper.instance() as any;

      expect(instance.state.startIndex).toBe(
        numVersions > 10 ? 10 : numVersions - 1,
      );
      instance.onBeginSelect(store.versionsToShow[2]);
      expect(instance.state.startIndex).toBe(2);
    });
  });

  describe('onEndSelect()', () => {
    it('sets the end version', () => {
      const wrapper = shallow(<BisectDialog appState={store} />);
      const instance: any = wrapper.instance() as any;

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

      const versions = generateVersionRange(numVersions);

      const wrapper = shallow(<BisectDialog appState={store} />);
      wrapper.setState({
        allVersions: versions,
        endIndex: 0,
        startIndex: versions.length - 1,
      });

      const instance: any = wrapper.instance() as any;
      await instance.onSubmit();
      expect(Bisector).toHaveBeenCalledWith(versions.reverse());
      expect(store.Bisector).toBeDefined();
      expect(store.setVersion as jest.Mock).toHaveBeenCalledWith(version);
    });

    it('does nothing if endIndex or startIndex are falsy', async () => {
      const wrapper = shallow(<BisectDialog appState={store} />);

      wrapper.setState({
        startIndex: undefined,
        endIndex: 0,
      });
      const instance1: any = wrapper.instance() as any;
      await instance1.onSubmit();
      expect(Bisector).not.toHaveBeenCalled();

      wrapper.setState({
        startIndex: 4,
        endIndex: undefined,
      });

      const instance2: any = wrapper.instance() as any;
      await instance2.onSubmit();
      expect(Bisector).not.toHaveBeenCalled();
    });
  });

  describe('onAuto()', () => {
    it('initiates autobisect', async () => {
      // setup: dialog state
      const wrapper = shallow(<BisectDialog appState={store} />);
      wrapper.setState({
        allVersions: generateVersionRange(numVersions),
        endIndex: 0,
        startIndex: 4,
      });

      (runner.autobisect as jest.Mock).mockResolvedValue(RunResult.SUCCESS);

      // click the 'auto' button
      const instance1: any = wrapper.instance() as any;
      await instance1.onAuto();

      // check the results
      expect(runner.autobisect).toHaveBeenCalled();
    });

    it('does nothing if endIndex or startIndex are falsy', async () => {
      const wrapper = shallow(<BisectDialog appState={store} />);

      wrapper.setState({
        startIndex: undefined,
        endIndex: 0,
      });
      const instance1: any = wrapper.instance() as any;
      await instance1.onAuto();
      expect(Bisector).not.toHaveBeenCalled();

      wrapper.setState({
        startIndex: 4,
        endIndex: undefined,
      });

      const instance2: any = wrapper.instance() as any;
      await instance2.onAuto();
      expect(Bisector).not.toHaveBeenCalled();
    });
  });

  describe('items disabled', () => {
    let instance: any;

    beforeEach(() => {
      const wrapper = shallow(<BisectDialog appState={store} />);
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
