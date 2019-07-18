import { shallow } from 'enzyme';
import * as React from 'react';

import { WarningDialog } from '../../../src/renderer/components/dialog-warning';
import { overridePlatform, resetPlatform } from '../../utils';

describe('TokenDialog component', () => {
  let store: any;

  beforeAll(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overridePlatform('darwin');
  });

  beforeEach(() => {
    store = {
      isWarningDialogShowing: false,
      warningDialogTexts: { label: '', ok: '', cancel: '' },
      toggleWarningDialog: jest.fn()
    };
  });

  afterAll(() => {
    resetPlatform();
  });

  it('renders', () => {
    store.isWarningDialogShowing = true;
    const wrapper = shallow(<WarningDialog appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('onClose() closes itself', () => {
    store.isWarningDialogShowing = true;
    const wrapper = shallow(<WarningDialog appState={store} />);
    const instance: WarningDialog = wrapper.instance() as any;

    instance.onClose(true);
    expect(store.toggleWarningDialog).toHaveBeenCalledTimes(1);
  });
});
