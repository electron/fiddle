import * as React from 'react';
import { observer } from 'mobx-react';
import * as Icon from '@fortawesome/react-fontawesome';
import { faTerminal, faUser, faDownload, faUpload } from '@fortawesome/fontawesome-free-solid';
import * as Octokit from '@octokit/rest';

import { Runner } from './runner';
import { VersionChooser } from './version-chooser';
import { AppState } from '../app';
import { clipboard } from 'electron';

export interface CommandsProps {
  appState: AppState;
}

const INDEX_HTML_NAME = 'index.html';
const MAIN_JS_NAME = 'main.js';
const RENDERER_JS_NAME = 'renderer.js';

@observer
export class Commands extends React.Component<CommandsProps, {}> {
  constructor(props: CommandsProps) {
    super(props);

    this.toggleConsole = this.toggleConsole.bind(this);
    this.showAuthDialog = this.showAuthDialog.bind(this);
    this.publishFiddle = this.publishFiddle.bind(this);
    this.loadFiddle = this.loadFiddle.bind(this);
  }

  public toggleConsole() {
    this.props.appState.isConsoleShowing = !this.props.appState.isConsoleShowing;
  }

  public showAuthDialog() {
    this.props.appState.isTokenDialogShowing = true;
  }

  public async publishFiddle() {
    const octo = new Octokit();
    octo.authenticate({
      type: 'token',
      token: this.props.appState.githubToken!
    });

    const values = (window as any).electronFiddle.getValues();

    const gist = await octo.gists.create({
      public: true,
      description: 'Electron Fiddle Gist',
      files: {
        [INDEX_HTML_NAME]: {
          content: values.html || '<!-- Empty -->',
        },
        [MAIN_JS_NAME]: {
          content: values.main || '// Empty',
        },
        [RENDERER_JS_NAME]: {
          content: values.renderer || '// Empty',
        },
      },
    });

    clipboard.writeText(gist.data.html_url);

    alert(`We've copied the Gist URL to your clipboard`);
  }

  public async loadFiddle() {
    const gistUrl = clipboard.readText();

    let gistMatch = gistUrl.match(/https:\/\/gist\.github\.com\/([^\/]+)$/);
    if (!gistMatch || !gistMatch[1]) {
      gistMatch = gistUrl.match(/https:\/\/gist\.github\.com\/[^\/]+\/([^\/]+)$/);
      if (!gistMatch || !gistMatch[1]) return;
    }

    if (!confirm('Are you sure you want to load a new fiddle, all current progress will be lost?')) return;

    const octo = new Octokit();

    const gist = await octo.gists.get({
      gist_id: gistMatch[1],
      id: gistMatch[1],
    });

    (window as any).electronFiddle.setValues({
      html: gist.data.files[INDEX_HTML_NAME].content,
      main: gist.data.files[MAIN_JS_NAME].content,
      renderer: gist.data.files[RENDERER_JS_NAME].content,
    });
  }

  public render() {
    const authButton = !this.props.appState.githubToken ? (
      <button className='button' onClick={this.showAuthDialog}>
        <Icon icon={faUser} />
      </button>
    ) : null;

    const saveButton = this.props.appState.githubToken ? (
      <button className='button' onClick={this.publishFiddle}>
        <Icon icon={faUpload} />
        <span style={{ marginLeft: 8 }} />
        Publish
      </button>
    ) : null;

    return (
      <div className='commands'>
        <div>
          <Runner appState={this.props.appState} />
          <VersionChooser appState={this.props.appState} />
        </div>
        <div>
          <button className='button' onClick={this.toggleConsole}>
            <Icon icon={faTerminal} />
          </button>
          <button className='button' onClick={this.loadFiddle}>
            <Icon icon={faDownload} />
            <span style={{ marginLeft: 8 }} />
            Load
          </button>
          {authButton}
          {saveButton}
        </div>
      </div>
    );
  }
}
