import * as React from 'react';

import { shallow } from 'enzyme';

import { GenericDialogType } from '../../../src/interfaces';
import { GenericDialog } from '../../../src/renderer/components/dialog-generic';
import { AppState } from '../../../src/renderer/state';
import { overrideRendererPlatform } from '../../utils';

describe('GenericDialog component', () => {
  let store: AppState;

  beforeEach(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overrideRendererPlatform('darwin');

    ({ state: store } = window.app);
  });

  describe('renders', () => {
    function expectDialogTypeToMatchSnapshot(type: GenericDialogType) {
      store.genericDialogOptions.type = type;
      store.isGenericDialogShowing = true;
      const wrapper = shallow(<GenericDialog appState={store} />);
      expect(wrapper).toMatchSnapshot();
    }

    it('warning', () => {
      expectDialogTypeToMatchSnapshot(GenericDialogType.warning);
    });

    it('confirmation', () => {
      expectDialogTypeToMatchSnapshot(GenericDialogType.confirm);
    });

    it('success', () => {
      expectDialogTypeToMatchSnapshot(GenericDialogType.success);
    });

    it('with an input prompt', () => {
      store.genericDialogOptions.wantsInput = true;
      expectDialogTypeToMatchSnapshot(GenericDialogType.confirm);
    });

    it('with an input prompt and placeholder', () => {
      store.genericDialogOptions.wantsInput = true;
      store.genericDialogOptions.placeholder = 'placeholder';
      expectDialogTypeToMatchSnapshot(GenericDialogType.confirm);
    });
  });

  it('onClose() closes itself', () => {
    store.isGenericDialogShowing = true;
    const wrapper = shallow(<GenericDialog appState={store} />);
    const instance: any = wrapper.instance();

    instance.onClose(true);
    expect(store.isGenericDialogShowing).toBe(false);
  });

  it('enter submit', () => {
    const wrapper = shallow(<GenericDialog appState={store} />);
    const instance: any = wrapper.instance();
    const event = { key: 'Enter' } as React.KeyboardEvent<HTMLInputElement>;

    store.isGenericDialogShowing = true;

    instance.enterSubmit(event);

    expect(store.isGenericDialogShowing).toBe(false);
  });
});
