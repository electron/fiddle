import { shallow } from 'enzyme';
import * as React from 'react';

import { GenericDialogType } from '../../../src/interfaces';
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
    (store as Partial<AppState>) = {
      isTokenDialogShowing: false,
      isSettingsShowing: false,
      isAddVersionDialogShowing: false,
      genericDialogOptions: {
        type: GenericDialogType.confirm,
        label: '',
        ok: '',
        cancel: '',
      },
      isGenericDialogShowing: true,
    };
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
