import { shallow } from 'enzyme';
import * as React from 'react';

import { MaximizeButton, RemoveButton } from '../../../src/renderer/components/editors-toolbar-button';
import { overridePlatform, resetPlatform } from '../../utils';

describe('Editor toolbar button component', () => {
  let store: any = {};
  let mockContext: any = {};

  beforeAll(() => {
    mockContext = {
      mosaicWindowActions: {
        getPath: jest.fn()
      },
      mosaicActions: {
        expand: jest.fn()
      }
    };

    store = {
      hideAndBackupEditor: jest.fn()
    };
  });

  describe('MaximizeButton', () => {
    it('renders', () => {
      const wrapper = shallow(<MaximizeButton appState={store} />);
      expect(wrapper).toMatchSnapshot();
    });

    it('handles a click', () => {
      const wrapper = shallow(<MaximizeButton appState={store} />);
      const instance: MaximizeButton = wrapper.instance() as any;
      instance.context = mockContext;

      instance.expand();
      expect(mockContext.mosaicActions.expand).toHaveBeenCalledTimes(1);
    });
  });

  describe('RemoveButton', () => {
    it('renders', () => {
      const wrapper = shallow(<RemoveButton appState={store} />);
      expect(wrapper).toMatchSnapshot();
    });

    it('handles a click', () => {
      const wrapper = shallow(<RemoveButton appState={store} />);
      const instance: MaximizeButton = wrapper.instance() as any;
      instance.context = mockContext;

      instance.remove();
      expect(store.hideAndBackupEditor).toHaveBeenCalledTimes(1);
    });
  });
});
