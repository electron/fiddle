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
  EnvVar,
  Flag,
}

interface ExecutionSettingsProps {
  appState: AppState;
}

interface ExecutionSettingsState {
  executionFlags: Record<string, string>;
  environmentVariables: Record<string, string>;
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
          return { [`flag-${idx}`]: flag };
        }),
      ),
      environmentVariables: Object.assign(
        {},
        ...props.appState.environmentVariables.map((envVar, idx) => {
          return { [`var-${idx}`]: envVar };
        }),
      ),
    };

    this.handleDeleteDataChange = this.handleDeleteDataChange.bind(this);
    this.handleElectronLoggingChange = this.handleElectronLoggingChange.bind(
      this,
    );

    this.handleSettingsItemChange = this.handleSettingsItemChange.bind(this);
    this.handleSettingsItemSave = this.handleSettingsItemSave.bind(this);
    this.addNewSettingsItem = this.addNewSettingsItem.bind(this);
  }

  public componentDidMount() {
    const { environmentVariables, executionFlags } = this.state;

    if (Object.keys(executionFlags).length === 0) {
      this.addNewSettingsItem(SettingItemType.Flag);
    }

    if (Object.keys(environmentVariables).length === 0) {
      this.addNewSettingsItem(SettingItemType.EnvVar);
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
   * Saves currently set execution flags or environment variables
   * run with the Electron executable.
   *
   * @param {SettingItemType} type
   */
  public handleSettingsItemSave(type: SettingItemType) {
    const { executionFlags, environmentVariables } = this.state;
    const { appState } = this.props;

    if (type === SettingItemType.Flag) {
      const flags = Object.values(executionFlags);
      appState.executionFlags = flags.filter((f) => f !== '');
    } else {
      const vars = Object.values(environmentVariables);
      appState.environmentVariables = vars.filter((v) => v !== '');
    }
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

    if (type === SettingItemType.Flag) {
      this.setState((prevState) => ({
        executionFlags: {
          ...prevState.executionFlags,
          [name]: value,
        },
      }));
    } else {
      this.setState((prevState) => ({
        environmentVariables: {
          ...prevState.environmentVariables,
          [name]: value,
        },
      }));
    }
  }

  /**
   * Adds a new settings item input field.
   *
   * @param {SettingItemType} type
   */
  private addNewSettingsItem(type: SettingItemType) {
    if (type === SettingItemType.Flag) {
      const flagsArray = Object.entries(this.state.executionFlags);

      this.setState((prevState) => ({
        executionFlags: {
          ...prevState.executionFlags,
          [`flag-${flagsArray.length}`]: '',
        },
      }));
    } else {
      const varsArray = Object.entries(this.state.environmentVariables);

      this.setState((prevState) => ({
        environmentVariables: {
          ...prevState.environmentVariables,
          [`var-${varsArray.length}`]: '',
        },
      }));
    }
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
    const clickFn = () => {
      if (type === SettingItemType.Flag) {
        const flags = this.state.executionFlags;
        if (Object.keys(flags).length === 1) {
          flags[idx] = '';
        } else {
          delete flags[idx];
        }

        this.setState({
          executionFlags: flags,
        });
      } else {
        const vars = this.state.environmentVariables;
        if (Object.keys(vars).length === 1) {
          vars[idx] = '';
        } else {
          delete vars[idx];
        }

        this.setState({
          environmentVariables: vars,
        });
      }
    };

    return <Button icon="cross" onClick={clickFn} />;
  }

  private renderEnvironmentVariables() {
    const { environmentVariables } = this.state;

    const varsArray = Object.entries(environmentVariables);
    const type = SettingItemType.EnvVar;

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
    const type = SettingItemType.Flag;

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

    const deleteUserDirLabel = `
      Whenever Electron runs, it creates a user data directory for cookies, the cache,
      and various other things that it needs to keep around. Since fiddles are usually
      just run once, we delete this directory after your fiddle exits. Enable this
      setting to keep the user data directories around.
    `.trim();
    const electronLoggingLabel = `
      There are some flags that Electron uses to log extra information both internally
      and through Chromium. Enable this option to make Fiddle produce those logs.`.trim();

    return (
      <div>
        <h2>Execution</h2>
        <Callout>
          These advanced settings control how Electron Fiddle executes your
          fiddles.
        </Callout>
        <br />
        <Callout>
          <FormGroup label={deleteUserDirLabel}>
            <Checkbox
              checked={isKeepingUserDataDirs}
              label="Do not delete user data directories."
              onChange={this.handleDeleteDataChange}
            />
          </FormGroup>
        </Callout>
        <br />
        <Callout>
          <FormGroup label={electronLoggingLabel}>
            <p>
              Enabling advanced Electron logging will set the{' '}
              <code>ELECTRON_ENABLE_LOGGING</code>,
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
              onClick={() => this.addNewSettingsItem(SettingItemType.Flag)}
            >
              Add New Flag
            </Button>
            <Button
              onClick={() => this.handleSettingsItemSave(SettingItemType.Flag)}
            >
              Save Flags
            </Button>
          </ButtonGroup>
        </Callout>
        <br />
        <Callout>
          {this.renderEnvironmentVariables()}
          <ButtonGroup>
            <Button
              onClick={() => this.addNewSettingsItem(SettingItemType.EnvVar)}
            >
              Add New Variable
            </Button>
            <Button
              onClick={() =>
                this.handleSettingsItemSave(SettingItemType.EnvVar)
              }
            >
              Save Variables
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
