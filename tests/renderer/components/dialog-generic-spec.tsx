import { shallow } from 'enzyme';
import * as React from 'react';

import { GenericDialogType } from '../../../src/interfaces';
import { GenericDialog } from '../../../src/renderer/components/dialog-generic';
import { AppState } from '../../../src/renderer/state';
import { overridePlatform, resetPlatform } from '../../utils';

describe('GenericDialog component', () => {
  let store: AppState;

  beforeAll(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overridePlatform('darwin');
  });

  beforeEach(() => {
    (store as Partial<AppState>) = {
      isGenericDialogShowing: false,
      genericDialogOptions: {
        type: GenericDialogType.warning,
        label: 'Some message',
        ok: 'Ok',
        cancel: '',
      },
      toggleGenericDialog: jest.fn(),
    };
  });

  afterAll(() => {
    resetPlatform();
  });

  it('renders a warning', () => {
    store.isGenericDialogShowing = true;
    const wrapper = shallow(<GenericDialog appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders a confirmation', () => {
    store.genericDialogOptions.type = GenericDialogType.confirm;
    store.isGenericDialogShowing = true;
    const wrapper = shallow(<GenericDialog appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders a success message', () => {
    store.genericDialogOptions.type = GenericDialogType.success;
    store.isGenericDialogShowing = true;
    const wrapper = shallow(<GenericDialog appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('onClose() closes itself', () => {
    store.isGenericDialogShowing = true;
    const wrapper = shallow(<GenericDialog appState={store} />);
    const instance: GenericDialog = wrapper.instance() as any;

    instance.onClose(true);
    expect(store.toggleGenericDialog).toHaveBeenCalledTimes(1);
  });
});
