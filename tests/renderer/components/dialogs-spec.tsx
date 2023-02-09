import * as React from 'react';

import { shallow } from 'enzyme';

import { Dialogs } from '../../../src/renderer/components/dialogs';
import { AppState } from '../../../src/renderer/state';
import { overridePlatform, resetPlatform } from '../../utils';

describe('Dialogs component', () => {
  let store: AppState;

  beforeAll(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overridePlatform('darwin');
  });

  beforeEach(() => {
    ({ state: store } = window.ElectronFiddle.app);
    store.isGenericDialogShowing = true;
  });

  afterAll(() => {
    resetPlatform();
  });

  it('renders the token dialog', () => {
    store.isTokenDialogShowing = true;
    const wrapper = shallow(<Dialogs appState={store} />);
    expect(wrapper.text()).toBe('<TokenDialog /><GenericDialog />');
  });

  it('renders the settings dialog', () => {
    store.isSettingsShowing = true;
    const wrapper = shallow(<Dialogs appState={store} />);
    expect(wrapper.text()).toBe('<Settings /><GenericDialog />');
  });

  it('renders the settings dialog', () => {
    store.isAddVersionDialogShowing = true;
    const wrapper = shallow(<Dialogs appState={store} />);
    expect(wrapper.text()).toBe('<AddVersionDialog /><GenericDialog />');
  });
});
