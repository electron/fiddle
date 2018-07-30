import * as React from 'react';
import { shallow } from 'enzyme';
import { spawn } from 'child_process';

import { Runner, ForgeCommands } from '../../../src/renderer/components/runner';
import { mockVersions } from '../../mocks/electron-versions';
import { ElectronFiddleMock } from '../../mocks/electron-fiddle';
import { findModulesInEditors, installModules, npmRun } from '../../../src/renderer/npm';
import { MockChildProcess } from '../../mocks/child-process';

jest.mock('../../../src/renderer/npm');
jest.mock('electron', () => require('../../mocks/electron'));
jest.mock('fs-extra');
jest.mock('child_process');

describe('Runner component', () => {
  let mockChild: MockChildProcess;

  beforeEach(() => {
    mockChild = new MockChildProcess();

    this.store = {
      version: '2.0.2',
      versions: mockVersions,
      downloadVersion: jest.fn(),
      removeVersion: jest.fn(),
      pushOutput: jest.fn(),
      pushError: jest.fn(),
      binaryManager: {
        getIsDownloaded: jest.fn(() => true),
        getElectronBinaryPath: jest.fn((version: string) => `/fake/path/${version}/electron`)
      },
    };

    (window as any).ElectronFiddle = new ElectronFiddleMock();
  });

  it('renders', () => {
    const wrapper = shallow(<Runner appState={this.store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('runs', async () => {
    const wrapper = shallow(<Runner appState={this.store} />);
    const instance: Runner = wrapper.instance() as any;

    (findModulesInEditors as any).mockReturnValueOnce([ 'fake-module' ]);
    (spawn as any).mockReturnValueOnce(mockChild);

    expect(await instance.run()).toBe(true);
    expect(this.store.binaryManager.getIsDownloaded).toHaveBeenCalled();
    expect(window.ElectronFiddle.app.fileManager.saveToTemp).toHaveBeenCalled();
    expect(installModules).toHaveBeenCalled();
    expect(wrapper.state('isRunning')).toBe(true);
  });

  it('emits output', async () => {
    const wrapper = shallow(<Runner appState={this.store} />);
    const instance: Runner = wrapper.instance() as any;

    (findModulesInEditors as any).mockReturnValueOnce([ 'fake-module' ]);
    (spawn as any).mockReturnValueOnce(mockChild);

    // Output
    expect(await instance.run()).toBe(true);
    mockChild.stdout.emit('data', 'hi');
    mockChild.stderr.emit('data', 'hi');
    expect(this.store.pushOutput).toHaveBeenCalledTimes(8);

    // Stop
    mockChild.emit('close', 0);
    expect(wrapper.state('isRunning')).toBe(false);
  });

  it('stops on close', async () => {
    const wrapper = shallow(<Runner appState={this.store} />);
    const instance: Runner = wrapper.instance() as any;

    (findModulesInEditors as any).mockReturnValueOnce([ 'fake-module' ]);
    (spawn as any).mockReturnValueOnce(mockChild);

    // Stop
    expect(await instance.run()).toBe(true);
    expect(wrapper.state('isRunning')).toBe(true);
    instance.stop();
    expect(wrapper.state('isRunning')).toBe(false);
  });

  it('stops on stop()', async () => {
    const wrapper = shallow(<Runner appState={this.store} />);
    const instance: Runner = wrapper.instance() as any;

    (findModulesInEditors as any).mockReturnValueOnce([ 'fake-module' ]);
    (spawn as any).mockReturnValueOnce(mockChild);

    // Stop
    expect(await instance.run()).toBe(true);
    mockChild.emit('close', 0);
    expect(wrapper.state('isRunning')).toBe(false);
  });

  it('does not run version not yet downloaded', async () => {
    const wrapper = shallow(<Runner appState={this.store} />);
    const instance: Runner = wrapper.instance() as any;

    this.store.binaryManager.getIsDownloaded.mockReturnValueOnce(false);

    expect(await instance.run()).toBe(false);
  });

  it('does not run if writing files fails', async () => {
    const wrapper = shallow(<Runner appState={this.store} />);
    const instance: Runner = wrapper.instance() as any;

    (window.ElectronFiddle.app.fileManager.saveToTemp as jest.Mock)
      .mockImplementationOnce(() => {
        throw new Error('bwap bwap');
      });

    expect(await instance.run()).toBe(false);
  });

  it('installs modules on installModules()', async () => {
    const wrapper = shallow(<Runner appState={this.store} />);
    const instance: Runner = wrapper.instance() as any;

    expect(await instance.npmInstall('')).toBe(true);
    expect(installModules).toHaveBeenCalled();
  });

  it('handles an error in installModules()', async () => {
    const wrapper = shallow(<Runner appState={this.store} />);
    const instance: Runner = wrapper.instance() as any;
    (installModules as any).mockImplementationOnce(() => {
      throw new Error('bwap bwap');
    });

    expect(await instance.npmInstall('')).toBe(false);
    expect(installModules).toHaveBeenCalled();
  });

  it('performs a package operation in performForgeOperation()', async () => {
    const wrapper = shallow(<Runner appState={this.store} />);
    const instance: Runner = wrapper.instance() as any;

    expect(await instance.performForgeOperation(ForgeCommands.PACKAGE)).toBe(true);
  });

  it('performs a make operation in performForgeOperation()', async () => {
    const wrapper = shallow(<Runner appState={this.store} />);
    const instance: Runner = wrapper.instance() as any;

    expect(await instance.performForgeOperation(ForgeCommands.MAKE)).toBe(true);
  });

  it('handles an error in saveToTemp() in performForgeOperation()', async () => {
    const wrapper = shallow(<Runner appState={this.store} />);
    const instance: Runner = wrapper.instance() as any;
    (instance as any).saveToTemp = jest.fn();

    expect(await instance.performForgeOperation(ForgeCommands.MAKE)).toBe(false);
  });

  it('handles an error in npmInstall() in performForgeOperation()', async () => {
    const wrapper = shallow(<Runner appState={this.store} />);
    const instance: Runner = wrapper.instance() as any;
    (installModules as any).mockImplementationOnce(() => {
      throw new Error('bwap bwap');
    });

    expect(await instance.performForgeOperation(ForgeCommands.MAKE)).toBe(false);
  });

  it('handles an error in npmRun() in performForgeOperation()', async () => {
    const wrapper = shallow(<Runner appState={this.store} />);
    const instance: Runner = wrapper.instance() as any;
    (npmRun as any).mockImplementationOnce(() => {
      throw new Error('bwap bwap');
    });

    expect(await instance.performForgeOperation(ForgeCommands.MAKE)).toBe(false);
  });
});
