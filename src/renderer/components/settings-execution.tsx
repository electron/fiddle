import {
  Button,
  ButtonGroup,
  Callout,
  Checkbox,
  FormGroup,
  InputGroup,
  Radio,
  RadioGroup,
} from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { IPackageManager } from '../npm';
import { AppState } from '../state';

export enum SettingItemType {
  EnvVars = 'environmentVariables',
  Flags = 'executionFlags',
}

interface ExecutionSettingsProps {
  appState: AppState;
}

interface ExecutionSettingsState {
  [setting: string]: Record<string, string>;
}

/**
 * Settings content to manage execution-related preferences.
 *
 * @class ExecutionSettings
 * @extends {React.Component<ExecutionSettingsProps, {}>}
 */
@observer
export class ExecutionSettings extends React.Component<
  ExecutionSettingsProps,
  ExecutionSettingsState
> {
  constructor(props: ExecutionSettingsProps) {
    super(props);

    this.state = {
      executionFlags: Object.assign(
        {},
        ...props.appState.executionFlags.map((flag, idx) => {
          return { [idx]: flag };
        }),
      ),
      environmentVariables: Object.assign(
        {},
        ...props.appState.environmentVariables.map((envVar, idx) => {
          return { [idx]: envVar };
        }),
      ),
    };

    this.handleDeleteDataChange = this.handleDeleteDataChange.bind(this);
    this.handleElectronLoggingChange = this.handleElectronLoggingChange.bind(
      this,
    );

    this.handleSettingsItemChange = this.handleSettingsItemChange.bind(this);
    this.addNewSettingsItem = this.addNewSettingsItem.bind(this);
  }

  public componentDidMount() {
    const { environmentVariables, executionFlags } = this.state;

    if (Object.keys(executionFlags).length === 0) {
      this.addNewSettingsItem(SettingItemType.Flags);
    }

    if (Object.keys(environmentVariables).length === 0) {
      this.addNewSettingsItem(SettingItemType.EnvVars);
    }
  }

  public componentDidUpdate() {
    const { appState } = this.props;

    for (const type of Object.values(SettingItemType)) {
      const values = Object.values(this.state[type]);
      appState[type] = values.filter((v) => v !== '');
    }
  }

  /**
   * Handles a change on whether or not the user data dir should be deleted
   * after a run.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public handleDeleteDataChange(event: React.FormEvent<HTMLInputElement>) {
    const { checked } = event.currentTarget;
    this.props.appState.isKeepingUserDataDirs = checked;
  }

  /**
   * Handles a change on whether or not electron should log more things
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   */
  public handleElectronLoggingChange(event: React.FormEvent<HTMLInputElement>) {
    const { checked } = event.currentTarget;
    this.props.appState.isEnablingElectronLogging = checked;
  }

  /**
   * Handles a change in the execution flags or environment variables
   * run with the Electron executable.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   * @param {SettingItemType} type
   */
  public handleSettingsItemChange(
    event: React.ChangeEvent<HTMLInputElement>,
    type: SettingItemType,
  ) {
    const { name, value } = event.currentTarget;

    this.setState((prevState) => ({
      [type]: {
        ...prevState[type],
        [name]: value,
      },
    }));
  }

  /**
   * Adds a new settings item input field.
   *
   * @param {SettingItemType} type
   */
  private addNewSettingsItem(type: SettingItemType) {
    const array = Object.entries(this.state[type]);

    this.setState((prevState) => ({
      [type as any]: {
        ...prevState[type],
        [array.length]: '',
      },
    }));
  }

  /**
   * Handle a change to the package manager used to install modules when running
   * Fiddles;
   *
   * @param {React.FormEvent<HTMLInputElement>} event
   */
  private handlePMChange = (event: React.FormEvent<HTMLInputElement>) => {
    const { appState } = this.props;
    const { value } = event.currentTarget;

    appState.packageManager = value as IPackageManager;
  };

  public renderDeleteItem(idx: string, type: SettingItemType): JSX.Element {
    const updated = this.state[type];

    const removeFn = () => {
      if (Object.keys(updated).length === 1) {
        updated[idx] = '';
      } else {
        delete updated[idx];
      }

      this.setState({ [type]: updated });
    };

    return (
      <Button
        icon="cross"
        disabled={Object.keys(updated).length === 1}
        onClick={removeFn}
      />
    );
  }

  private renderEnvironmentVariables() {
    const { environmentVariables } = this.state;

    const varsArray = Object.entries(environmentVariables);
    const type = SettingItemType.EnvVars;

    return (
      <FormGroup>
        <p>
          Electron allows starting the executable with{' '}
          <a href="https://www.electronjs.org/docs/api/environment-variables">
            user-provided environment variables
          </a>
          , such as{' '}
          <code>
            NODE_OPTIONS=&quot;--no-warnings --max-old-space-size=2048&quot;
          </code>
          . Those can be added here to run when you start your Fiddles.
        </p>
        <br />
        {varsArray.map(([idx, envVar]) => {
          return (
            <InputGroup
              placeholder='NODE_OPTIONS="--no-warnings --max-old-space-size=2048"'
              value={envVar}
              name={idx}
              key={idx}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                this.handleSettingsItemChange(e, type)
              }
              rightElement={this.renderDeleteItem(idx, type)}
            />
          );
        })}
      </FormGroup>
    );
  }

  private renderExecutionFlags() {
    const { executionFlags } = this.state;

    const flagsArray = Object.entries(executionFlags);
    const type = SettingItemType.Flags;

    return (
      <FormGroup>
        <p>
          Electron allows starting the executable with{' '}
          <a href="https://www.electronjs.org/docs/api/command-line-switches">
            user-provided flags
          </a>
          , such as <code>--js-flags=--expose-gc</code>. Those can be added to
          run when you start your Fiddles.
        </p>
        <br />
        {flagsArray.map(([idx, flag]) => {
          return (
            <InputGroup
              placeholder="--js-flags=--expose-gc"
              value={flag}
              name={idx}
              key={idx}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                this.handleSettingsItemChange(e, type)
              }
              rightElement={this.renderDeleteItem(idx, type)}
            />
          );
        })}
      </FormGroup>
    );
  }

  public render() {
    const {
      isKeepingUserDataDirs,
      isEnablingElectronLogging,
    } = this.props.appState;

    return (
      <div>
        <h2>Execution</h2>
        <Callout>
          These advanced settings control how Electron Fiddle executes your
          fiddles.
        </Callout>
        <br />
        <Callout>
          <FormGroup>
            <p>
              Whenever Electron runs, it creates a user data directory for
              cookies, the cache, and various other things that it needs to keep
              around. Since fiddles are usually just run once, we delete this
              directory after your fiddle exits. Enable this setting to keep the
              user data directories around.
            </p>
            <Checkbox
              checked={isKeepingUserDataDirs}
              label="Do not delete user data directories."
              onChange={this.handleDeleteDataChange}
            />
          </FormGroup>
        </Callout>
        <br />
        <Callout>
          <FormGroup>
            <p>
              There are some flags that Electron uses to log extra information
              both internally and through Chromium. Enable this option to make
              Fiddle produce those logs. Enabling advanced Electron logging will
              set the <code>ELECTRON_ENABLE_LOGGING</code>,{' '}
              <code>ELECTRON_DEBUG_NOTIFICATION</code>, and{' '}
              <code>ELECTRON_ENABLE_STACK_DUMPING</code> environment variables
              to true. See{' '}
              <a href="https://www.electronjs.org/docs/api/environnment-variables">
                documentation
              </a>{' '}
              for more information about what they do.
            </p>
            <Checkbox
              checked={isEnablingElectronLogging}
              label="Enable advanced Electron logging."
              onChange={this.handleElectronLoggingChange}
            />
          </FormGroup>
        </Callout>
        <br />
        <Callout>
          {this.renderExecutionFlags()}
          <ButtonGroup>
            <Button
              onClick={() => this.addNewSettingsItem(SettingItemType.Flags)}
            >
              Add New Flag
            </Button>
          </ButtonGroup>
        </Callout>
        <br />
        <Callout>
          {this.renderEnvironmentVariables()}
          <ButtonGroup>
            <Button
              onClick={() => this.addNewSettingsItem(SettingItemType.EnvVars)}
            >
              Add New Variable
            </Button>
          </ButtonGroup>
        </Callout>
        <br />
        <Callout>
          <FormGroup>
            <span style={{ marginRight: 4 }}>
              Electron Fiddle will install packages on runtime if they are
              imported within your fiddle with <code>require</code>. It uses{' '}
              <a href="https://www.npmjs.com/" target="_blank" rel="noreferrer">
                npm
              </a>{' '}
              as its package manager by default, but{' '}
              <a
                href="https://classic.yarnpkg.com/lang/en/"
                target="_blank"
                rel="noreferrer"
              >
                Yarn
              </a>{' '}
              is also available.
            </span>
            <RadioGroup
              onChange={this.handlePMChange}
              selectedValue={this.props.appState.packageManager}
              inline={true}
            >
              <Radio label="npm" value="npm" />
              <Radio label="yarn" value="yarn" />
            </RadioGroup>
          </FormGroup>
        </Callout>
      </div>
    );
  }
}
