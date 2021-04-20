import * as React from 'react';
import { shallow } from 'enzyme';

import { Commands } from '../../../src/renderer/components/commands';

import { AppMock } from '../../mocks/app';

jest.mock('../../../src/renderer/components/commands-runner', () => ({
  Runner: 'runner',
}));

jest.mock('../../../src/renderer/components/commands-version-chooser', () => ({
  VersionChooser: 'version-chooser',
}));

jest.mock('../../../src/renderer/components/commands-address-bar', () => ({
  AddressBar: 'address-bar',
}));

jest.mock('../../../src/renderer/components/commands-action-button', () => ({
  GistActionButton: 'action-button',
}));

describe('Commands component', () => {
  let app: AppMock;

  beforeEach(() => {
    app = new AppMock();
    app.state = { gistId: null } as any;
  });

  it('renders', () => {
    const wrapper = shallow(
      <Commands
        appState={app.state as any}
        editorMosaic={app.editorMosaic as any}
      />,
    );
    expect(wrapper).toMatchSnapshot();
  });
});
