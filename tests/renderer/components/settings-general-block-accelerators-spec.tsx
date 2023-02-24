import * as React from 'react';

import { shallow } from 'enzyme';

import { BlockableAccelerator } from '../../../src/interfaces';
import { BlockAcceleratorsSettings } from '../../../src/renderer/components/settings-general-block-accelerators';
import { AppState } from '../../../src/renderer/state';

describe('BlockAcceleratorsSettings component', () => {
  let store: AppState;

  beforeEach(() => {
    ({ state: store } = window.ElectronFiddle.app);
  });

  it('renders', () => {
    const wrapper = shallow(<BlockAcceleratorsSettings appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  describe('handleBlockAcceleratorChange()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(<BlockAcceleratorsSettings appState={store} />);
      const instance = wrapper.instance() as any;

      await instance.handleBlockAcceleratorChange({
        currentTarget: { checked: false, value: BlockableAccelerator.save },
      });

      expect(store.removeAcceleratorToBlock as jest.Mock).toHaveBeenCalledWith(
        BlockableAccelerator.save,
      );

      await instance.handleBlockAcceleratorChange({
        currentTarget: { checked: true, value: BlockableAccelerator.save },
      });

      expect(store.addAcceleratorToBlock as jest.Mock).toHaveBeenCalledWith(
        BlockableAccelerator.save,
      );
    });
  });
});
