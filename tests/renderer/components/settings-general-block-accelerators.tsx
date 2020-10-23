import { shallow } from 'enzyme';
import * as React from 'react';
import { BlockableAccelerator } from '../../../src/interfaces';

import { BlockAcceleratorsSettings } from '../../../src/renderer/components/settings-general-block-accelerators';

describe('BlockAcceleratorsSettings component', () => {
  let store: any;

  beforeEach(() => {
    store = {};
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

      expect(store.acceleratorsToBlock).toBe([]);

      await instance.handleBlockAcceleratorChange({
        currentTarget: { checked: false, value: BlockableAccelerator.save },
      });

      expect(store.acceleratorsToBlock).toBe([BlockableAccelerator.save]);
    });
  });
});
