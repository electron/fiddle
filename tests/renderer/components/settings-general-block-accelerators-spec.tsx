import * as React from 'react';

import { shallow } from 'enzyme';

import { BlockableAccelerator } from '../../../src/interfaces';
import { BlockAcceleratorsSettings } from '../../../src/renderer/components/settings-general-block-accelerators';
import { AppState } from '../../../src/renderer/state';

describe('BlockAcceleratorsSettings component', () => {
  let store: AppState;

  beforeEach(() => {
    ({ state: store } = window.app);
  });

  it('renders', () => {
    const wrapper = shallow(<BlockAcceleratorsSettings appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  describe('handleBlockAcceleratorChange()', () => {
    it('handles a new selection', async () => {
      const wrapper = shallow(<BlockAcceleratorsSettings appState={store} />);
      const instance: any = wrapper.instance();

      instance.handleBlockAcceleratorChange({
        currentTarget: { checked: false, value: BlockableAccelerator.save },
      } as React.FormEvent<HTMLInputElement>);

      expect(store.removeAcceleratorToBlock).toHaveBeenCalledWith(
        BlockableAccelerator.save,
      );

      instance.handleBlockAcceleratorChange({
        currentTarget: { checked: true, value: BlockableAccelerator.save },
      } as React.FormEvent<HTMLInputElement>);

      expect(store.addAcceleratorToBlock).toHaveBeenCalledWith(
        BlockableAccelerator.save,
      );
    });
  });
});
