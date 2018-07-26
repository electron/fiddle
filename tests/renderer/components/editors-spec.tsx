import * as React from 'react';
import { shallow } from 'enzyme';

import { getFocusedEditor } from '../../../src/utils/focused-editor';
import { Editors } from '../../../src/renderer/components/editors';

jest.mock('../../../src/renderer/components/editor', () => ({
  Editor: 'Editor'
}));

jest.mock('electron', () => require('../../mocks/electron'));

jest.mock('../../../src/utils/focused-editor', () => ({
  getFocusedEditor: jest.fn()
}));

describe('Editrors component', () => {
  beforeEach(() => {
    this.store = {
      isTokenDialogShowing: false,
      isSettingsShowing: false
    };

    this.monaco = {
      editor: {
        defineTheme: jest.fn()
      }
    };
  });

  it('renders', () => {
    const wrapper = shallow(<Editors appState={this.store} />);
    wrapper.setState({ monaco: this.monaco });
    expect(wrapper).toMatchSnapshot();
  });

  it('executes a command on an editor', () => {
    const wrapper = shallow(<Editors appState={this.store} />);
    const instance = wrapper.instance();
    const mockAction = {
      isSupported: jest.fn(() => true),
      run: jest.fn()
    };
    const mockEditor = {
      getAction: jest.fn(() => mockAction)
    };

    (getFocusedEditor as any).mockReturnValueOnce(mockEditor);

    (instance as any).executeCommand('hello');
    expect(mockEditor.getAction).toHaveBeenCalled();
    expect(mockAction.isSupported).toHaveBeenCalled();
    expect(mockAction.run).toHaveBeenCalled();
  });

  it('does not execute command if not supported', () => {
    const wrapper = shallow(<Editors appState={this.store} />);
    const instance = wrapper.instance();
    const mockAction = {
      isSupported: jest.fn(() => false),
      run: jest.fn()
    };
    const mockEditor = {
      getAction: jest.fn(() => mockAction)
    };

    (getFocusedEditor as any).mockReturnValueOnce(mockEditor);

    (instance as any).executeCommand('hello');
    expect(mockEditor.getAction).toHaveBeenCalled();
    expect(mockAction.isSupported).toHaveBeenCalled();
    expect(mockAction.run).toHaveBeenCalledTimes(0);
  });
});
