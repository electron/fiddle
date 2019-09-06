import { shallow } from 'enzyme';
import * as React from 'react';
import { ElectronVersionSource, ElectronVersionState } from '../../../src/interfaces';
import { Bisector } from '../../../src/renderer/bisect';
import { BisectDialog } from '../../../src/renderer/components/dialog-bisect';
import { ElectronReleaseChannel } from '../../../src/renderer/versions';

jest.mock('../../../src/renderer/bisect');

describe('BisectDialog component', () => {
  let store: any;

  const generateVersionRange = (rangeLength: number) =>
    (new Array(rangeLength)).fill(0).map((_, i) => ({
      state: ElectronVersionState.ready,
      version: `${i + 1}.0.0`,
      source: ElectronVersionSource.local
    }));

  beforeEach(() => {
    store = {
      versions: generateVersionRange(5),
      versionsToShow: [ElectronReleaseChannel.stable],
      statesToShow: [ElectronVersionState.ready],
      setVersion: jest.fn()
    };
  });

  it('renders', () => {
    const wrapper = shallow(<BisectDialog appState={store} />);
    // start and end selected
    wrapper.setState({
      startIndex: 3,
      endIndex: 0,
      allVersions: generateVersionRange(5)
    });
    expect(wrapper).toMatchSnapshot();

    // no selection
    wrapper.setState({
      startIndex: undefined,
      endIndex: undefined,
      allVersions: generateVersionRange(5)
    });
    expect(wrapper).toMatchSnapshot();

    // only start selected
    wrapper.setState({
      startIndex: 3,
      endIndex: undefined,
      allVersions: generateVersionRange(5)
    });
    expect(wrapper).toMatchSnapshot();
  });

  describe('onBeginSelect()', () => {
    it('sets the begin version', () => {
      const wrapper = shallow(<BisectDialog appState={store} />);
      const instance: BisectDialog = wrapper.instance() as any;

      expect(instance.state.startIndex).toBeUndefined();
      instance.onBeginSelect(store.versions[2]);
      expect(instance.state.startIndex).toBe(2);
    });
  });

  describe('onEndSelect()', () => {
    it('sets the end version', () => {
      const wrapper = shallow(<BisectDialog appState={store} />);
      const instance: BisectDialog = wrapper.instance() as any;

      expect(instance.state.endIndex).toBeUndefined();
      instance.onEndSelect(store.versions[2]);
      expect(instance.state.endIndex).toBe(2);
    });
  });

  describe('onSubmit()', () => {
    it('initiates a bisect instance and sets a version', async () => {
      const version = '1.0.0';
      (Bisector as jest.Mock).mockImplementation(() => {
        return {
          getCurrentVersion: () => ({ version })
        };
      });

      const versions = generateVersionRange(5);

      const wrapper = shallow(<BisectDialog appState={store} />);
      wrapper.setState({
        startIndex: 4,
        endIndex: 0,
        allVersions: versions
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
        endIndex: 0
      });
      const instance1: BisectDialog = wrapper.instance() as any;
      await instance1.onSubmit();
      expect(Bisector).not.toHaveBeenCalled();

      wrapper.setState({
        startIndex: 4,
        endIndex: undefined
      });
      const instance2: BisectDialog = wrapper.instance() as any;
      await instance2.onSubmit();
      expect(Bisector).not.toHaveBeenCalled();

    });
  });
});
