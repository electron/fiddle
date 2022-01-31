import * as React from 'react';
import { Button, MenuItem, Tree, TreeNodeInfo } from '@blueprintjs/core';
import { Suggest } from '@blueprintjs/select';
import { autorun } from 'mobx';
import { observer } from 'mobx-react';
import pDebounce from 'p-debounce';
import semver from 'semver';

import { AppState } from '../state';
import { npmSearch } from '../npm-search';
interface IState {
  suggestions: Array<AlgoliaHit>;
  versionsCache: Map<string, string[]>;
}

interface IProps {
  appState: AppState;
}

// See full schema: https://github.com/algolia/npm-search#schema
interface AlgoliaHit {
  name: string;
  version: string;
  versions: Record<string, string>;
  _highlightResult: {
    name: {
      value: string;
    };
  };
}

@observer
export class SidebarPackageManager extends React.Component<IProps, IState> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      suggestions: [],
      versionsCache: new Map(),
    };
  }

  public componentDidMount() {
    autorun(async () => {
      await this.refreshVersionsCache();
      this.coerceInvalidVersionNumbers();
    });
  }

  public addModuleToFiddle = (item: AlgoliaHit) => {
    const { appState } = this.props;
    appState.modules.set(item.name, item.version);
    // copy state so react can re-render
    this.state.versionsCache.set(item.name, Object.keys(item.versions));
    const newCache = new Map(this.state.versionsCache);
    this.setState({ suggestions: [], versionsCache: newCache });
  };

  public render() {
    return (
      <div>
        <h5>Modules</h5>
        <Suggest
          fill={true}
          inputValueRenderer={() => ''}
          items={this.state.suggestions}
          itemRenderer={(item, { modifiers, handleClick }) => (
            <MenuItem
              active={modifiers.active}
              key={item.name}
              text={
                <span
                  className="package-manager-result"
                  dangerouslySetInnerHTML={{
                    __html: item._highlightResult.name.value,
                  }}
                />
              }
              onClick={handleClick}
            />
          )}
          noResults={<em>Search for modules here...</em>}
          onItemSelect={this.addModuleToFiddle}
          onQueryChange={pDebounce(async (query) => {
            if (query !== '') {
              const { hits } = await npmSearch.search(query);
              this.setState({
                suggestions: hits,
              });
            } else {
              this.setState({
                suggestions: [],
              });
            }
          }, 200)}
          popoverProps={{ minimal: true, usePortal: false, fill: true }}
          resetOnClose={true}
          resetOnSelect={true}
        />
        <Tree contents={this.getModuleNodes()} />
      </div>
    );
  }

  /**
   * Takes the module map and returns an object
   * conforming to the BlueprintJS tree schema.
   * @returns TreeNodeInfo[]
   */
  private getModuleNodes = (): TreeNodeInfo[] => {
    const values: TreeNodeInfo[] = [];
    const { appState } = this.props;
    for (const [pkg, activeVersion] of appState.modules.entries()) {
      values.push({
        id: pkg,
        label: pkg,
        secondaryLabel: (
          <div>
            <select
              style={{ width: '80px', textOverflow: 'ellipsis' }}
              name={pkg}
              value={activeVersion}
              onChange={({ target }) =>
                appState.modules.set(target.name, target.value)
              }
            >
              {this.state.versionsCache.get(pkg)?.map((version) => (
                <option key={version}>{version}</option>
              ))}
            </select>

            <Button
              minimal
              icon="remove"
              onClick={() => appState.modules.delete(pkg)}
            />
          </div>
        ),
      });
    }

    return values;
  };

  /**
   * Attempt to fetch the list of all versions for
   * all installed modules. We need this list of versions
   * for the version selector.
   */
  private refreshVersionsCache = async () => {
    const { modules } = this.props.appState;

    for (const pkg of modules.keys()) {
      if (!this.state.versionsCache.has(pkg)) {
        const { hits } = await npmSearch.search(pkg);
        const firstMatch = hits[0];
        if (firstMatch === undefined || !firstMatch.versions) {
          console.warn(
            `Attempted to fetch version list for ${pkg} from Algolia but failed!`,
          );
        } else {
          this.state.versionsCache.set(
            firstMatch.name,
            Object.keys(firstMatch.versions),
          );
          this.setState((prevState) => ({
            versionsCache: new Map(prevState.versionsCache),
          }));
        }
      }
    }
  };

  /**
   * Coerces any invalid semver versions to the latest
   * version detected in the versionsCache. This is particularly
   * useful for loading gists created with older versions of
   * Fiddle that have wildcard (*) versions in their package.json
   *
   * This function should only be run after the versions cache
   * is updated so we have an updated list of all deps and their
   * versions.
   */
  private coerceInvalidVersionNumbers = () => {
    const { modules } = this.props.appState;

    for (const [pkg, version] of modules.entries()) {
      if (!semver.valid(version)) {
        const packageVersions = this.state.versionsCache.get(pkg);

        if (Array.isArray(packageVersions) && packageVersions.length > 0) {
          const latestVersion = packageVersions[packageVersions.length - 1];
          modules.set(pkg, latestVersion);
        } else {
          console.warn(
            `Attempted to coerce latest version for package '${pkg}' but failed.`,
          );
        }
      }
    }
  };
}
