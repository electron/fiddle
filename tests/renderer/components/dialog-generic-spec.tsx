import * as React from 'react';

import { shallow } from 'enzyme';

import { GenericDialogType } from '../../../src/interfaces';
import { GenericDialog } from '../../../src/renderer/components/dialog-generic';
import { StateMock } from '../../mocks/mocks';
import { overrideRendererPlatform } from '../../utils';

describe('GenericDialog component', () => {
  let store: StateMock;

  beforeEach(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overrideRendererPlatform('darwin');

    ({ state: store } = (window as any).ElectronFiddle.app);
  });

  describe('renders', () => {
    function expectDialogTypeToMatchSnapshot(type: GenericDialogType) {
      store.genericDialogOptions.type = type;
      store.isGenericDialogShowing = true;
      const wrapper = shallow(<GenericDialog appState={store as any} />);
      expect(wrapper).toMatchSnapshot();
    }

    it('warning', () => {
      expectDialogTypeToMatchSnapshot(GenericDialogType.warning);
    });

    it('confirmation', () => {
      expectDialogTypeToMatchSnapshot(GenericDialogType.confirm);
    });

    it('confirmation', () => {
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
    const wrapper = shallow(<GenericDialog appState={store as any} />);
    const instance: any = wrapper.instance() as any;

    instance.onClose(true);
    expect(store.isGenericDialogShowing).toBe(false);
  });

  it('enter submit', () => {
    const wrapper = shallow(<GenericDialog appState={store as any} />);
    const instance: any = wrapper.instance() as any;
    const event = { key: 'Enter' };

    store.isGenericDialogShowing = true;

    instance.enterSubmit(event as any);

    expect(store.isGenericDialogShowing).toBe(false);
  });
});
