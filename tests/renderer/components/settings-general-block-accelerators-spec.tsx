import { shallow } from 'enzyme';
import * as React from 'react';
import { BlockableAccelerator } from '../../../src/interfaces';

import { BlockAcceleratorsSettings } from '../../../src/renderer/components/settings-general-block-accelerators';

import { StateMock } from '../../mocks/mocks';

describe('BlockAcceleratorsSettings component', () => {
  let store: StateMock;

  beforeEach(() => {
    ({ state: store } = (window as any).ElectronFiddle.app);
  });

  it('renders', () => {
    const wrapper = shallow(
      <BlockAcceleratorsSettings appState={store as any} />,
    );
    expect(wrapper).toMatchSnapshot();
  });

  describe('handleBlockAcceleratorChange()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(
        <BlockAcceleratorsSettings appState={store as any} />,
      );
      const instance = wrapper.instance() as any;

      await instance.handleBlockAcceleratorChange({
        currentTarget: { checked: false, value: BlockableAccelerator.save },
      });

      expect(store.removeAcceleratorToBlock).toHaveBeenCalledWith(
        BlockableAccelerator.save,
      );

      await instance.handleBlockAcceleratorChange({
        currentTarget: { checked: true, value: BlockableAccelerator.save },
      });

      expect(store.addAcceleratorToBlock).toHaveBeenCalledWith(
        BlockableAccelerator.save,
      );
    });
  });
});
