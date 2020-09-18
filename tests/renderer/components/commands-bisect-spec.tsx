import { shallow, ShallowWrapper } from 'enzyme';
import * as React from 'react';
import { VersionState } from '../../../src/interfaces';
import { BisectHandler } from '../../../src/renderer/components/commands-bisect';

describe('Bisect commands component', () => {
  let store: any;

  beforeEach(() => {
    store = {
      Bisector: {
        continue: jest.fn(),
        getCurrentVersion: jest.fn(),
      },
      currentElectronVersion: {
        state: VersionState.ready,
      },
      setVersion: jest.fn(),
      version: '1.0.0',
      pushOutput: jest.fn(),
      setGenericDialogOptions: jest.fn(),
      isGenericDialogShowing: false,
    };
  });

  it('renders helper buttons if bisect instance is active', () => {
    const wrapper = shallow(<BisectHandler appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('disables helper buttons if Electron binary is downloading', () => {
    store.currentElectronVersion.state = VersionState.downloading;
    const wrapper = shallow(<BisectHandler appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('renders bisect dialog button if no bisect instance', () => {
    delete store.Bisector;
    const wrapper = shallow(<BisectHandler appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  describe('buttons', () => {
    let wrapper: ShallowWrapper;
    let instance: BisectHandler;
    beforeEach(() => {
      wrapper = shallow(<BisectHandler appState={store} />);
      instance = wrapper.instance() as any;
      instance.continueBisect = jest.fn();
    });

    it('passes in Version=Good when thumbs up button is pressed', () => {
      wrapper.find('[icon="thumbs-up"]').simulate('click');
      expect(instance.continueBisect).toHaveBeenCalledWith(true);
    });

    it('passes in Version=Bad when thumbs down button is pressed', () => {
      wrapper.find('[icon="thumbs-down"]').simulate('click');
      expect(instance.continueBisect).toHaveBeenCalledWith(false);
    });
  });

  describe('continueBisect()', () => {
    it('closes the currently running app', () => {
      const wrapper = shallow(<BisectHandler appState={store} />);
      const instance: BisectHandler = wrapper.instance() as any;

      store.Bisector.continue.mockReturnValue({
        version: '2.0.0',
      });
      const mockStop = jest.fn();
      window.ElectronFiddle.app.runner.stop = mockStop;
      instance.continueBisect(true);

      expect(mockStop).toHaveBeenCalled();
    });

    it('sets version assigned by bisect algorithm', () => {
      const wrapper = shallow(<BisectHandler appState={store} />);
      const instance: BisectHandler = wrapper.instance() as any;

      store.Bisector.continue.mockReturnValue({
        version: '2.0.0',
      });
      instance.continueBisect(true);
      expect(store.setVersion).toHaveBeenCalledWith('2.0.0');
    });

    it('terminates bisect if algorithm returns array', () => {
      const wrapper = shallow(<BisectHandler appState={store} />);
      const instance: BisectHandler = wrapper.instance() as any;
      instance.terminateBisect = jest.fn();

      // same value is only returned when there is only 1 version left
      store.Bisector.continue.mockReturnValue([
        { version: 'minVer' },
        { version: 'maxVer' },
      ]);
      instance.continueBisect(true);
      expect(store.setVersion).not.toHaveBeenCalled();
      expect(instance.terminateBisect).toHaveBeenCalled();
      expect(store.pushOutput).toHaveBeenCalled();
      expect(store.isGenericDialogShowing).toEqual(true);
      expect(store.setGenericDialogOptions).toHaveBeenCalledWith({
        cancel: undefined,
        label: (
          <>
            Bisect complete. Check the range{' '}
            <a
              target="_blank"
              rel="noreferrer"
              href={`https://github.com/electron/electron/compare/vminVer...vmaxVer`}
            >
              {'minVer'}...{'maxVer'}
            </a>
            .
          </>
        ),
        type: 'success',
      });
    });
  });

  describe('terminateBisect()', () => {
    it('removes the bisect instance from the app state', () => {
      const wrapper = shallow(<BisectHandler appState={store} />);
      const instance: BisectHandler = wrapper.instance() as any;

      instance.terminateBisect();
      expect(store.Bisector).toBeUndefined();
    });
  });
});
