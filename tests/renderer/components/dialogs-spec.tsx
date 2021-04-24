import * as React from 'react';
import { shallow } from 'enzyme';

import { Dialogs } from '../../../src/renderer/components/dialogs';
import { overridePlatform, resetPlatform } from '../../utils';

import { StateMock } from '../../mocks/mocks';

describe('Dialogs component', () => {
  let store: StateMock;

  beforeAll(() => {
    // We render the buttons different depending on the
    // platform, so let' have a uniform platform for unit tests
    overridePlatform('darwin');
  });

  beforeEach(() => {
    ({ state: store } = (window as any).ElectronFiddle.app);
    store.isGenericDialogShowing = true;
  });

  afterAll(() => {
    resetPlatform();
  });

  it('renders the token dialog', () => {
    store.isTokenDialogShowing = true;
    const wrapper = shallow(<Dialogs appState={store as any} />);
    expect(wrapper.text()).toBe('<TokenDialog /><GenericDialog />');
  });

  it('renders the settings dialog', () => {
    store.isSettingsShowing = true;
    const wrapper = shallow(<Dialogs appState={store as any} />);
    expect(wrapper.text()).toBe('<Settings /><GenericDialog />');
  });

  it('renders the settings dialog', () => {
    store.isAddVersionDialogShowing = true;
    const wrapper = shallow(<Dialogs appState={store as any} />);
    expect(wrapper.text()).toBe('<AddVersionDialog /><GenericDialog />');
  });
});
