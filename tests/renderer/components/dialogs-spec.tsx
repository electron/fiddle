import { shallow } from 'enzyme';
import * as React from 'react';

import { Dialogs } from '../../../src/renderer/components/dialogs';
import { overridePlatform, resetPlatform } from '../../utils';

describe('Dialogs component', () => {
  let store: any = {};

  beforeAll(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overridePlatform('darwin');
  });

  beforeEach(() => {
    store = {
      isTokenDialogShowing: false,
      isSettingsShowing: false,
      isAddVersionDialogShowing: false,
      warningDialogTexts: { label: '', ok: '', cancel: '' }
    };
  });

  afterAll(() => {
    resetPlatform();
  });

  it('renders the token dialog', () => {
    store.isTokenDialogShowing = true;
    const wrapper = shallow(<Dialogs appState={store} />);
    expect(wrapper.text()).toBe('<TokenDialog /><ConfirmDialog />');
  });

  it('renders the settings dialog', () => {
    store.isSettingsShowing = true;
    const wrapper = shallow(<Dialogs appState={store} />);
    expect(wrapper.text()).toBe('<Settings /><ConfirmDialog />');
  });

  it('renders the settings dialog', () => {
    store.isAddVersionDialogShowing = true;
    const wrapper = shallow(<Dialogs appState={store} />);
    expect(wrapper.text()).toBe('<AddVersionDialog /><ConfirmDialog />');
  });
});
