import { shallow } from 'enzyme';
import * as React from 'react';

import { GenericDialog } from '../../../src/renderer/components/dialog-generic';
import { overridePlatform, resetPlatform } from '../../utils';
import { AppState } from '../../../src/renderer/state';
import { GenericDialogType } from '../../../src/interfaces';

describe('TokenDialog component', () => {
  let store: AppState;

  beforeAll(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overridePlatform('darwin');
  });

  beforeEach(() => {
    (store as Partial<AppState>) = {
      isGenericDialogShowing: false,
      genericDialogOptions: { type: GenericDialogType.warning,label: '', ok: '', cancel: '' },
      toggleGenericDialog: jest.fn()
    };
  });

  afterAll(() => {
    resetPlatform();
  });

  it('renders', () => {
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
