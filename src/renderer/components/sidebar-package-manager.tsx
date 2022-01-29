import * as React from 'react';
import { Button, MenuItem, Tree, TreeNodeInfo } from '@blueprintjs/core';
import { Suggest } from '@blueprintjs/select';
import { SearchResponse } from '@algolia/client-search';
import algoliasearch from 'algoliasearch/lite';
import pDebounce from 'p-debounce';
import { observer } from 'mobx-react';

import { AppState } from '../state';

const client = algoliasearch('OFCNCOG2CU', '4efa2042cf4dba11be6e96e5c394e1a4');
const index = client.initIndex('npm-search');

interface IState {
  searchCache: Map<string, SearchResponse<AlgoliaHit>>;
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
      searchCache: new Map(),
      suggestions: [],
      versionsCache: new Map(),
    };
  }

  public addPackageToFiddle = (item: AlgoliaHit) => {
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
          onItemSelect={this.addPackageToFiddle}
          onQueryChange={pDebounce(async (query) => {
            if (query !== '') {
              let searchResult: SearchResponse<AlgoliaHit>;

              // Cache Algolia hits
              if (this.state.searchCache.has(query)) {
                searchResult = this.state.searchCache.get(query)!;
              } else {
                searchResult = await index.search<AlgoliaHit>(query, {
                  hitsPerPage: 5,
                });
                this.state.searchCache.set(query, searchResult);
              }
              this.setState({
                suggestions: searchResult.hits,
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
  public getModuleNodes = (): TreeNodeInfo[] => {
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
   * all installed modules.
   */
  public refreshVersionsCache = async () => {
    const cache = this.props.appState.modules;
    for (const pkg of cache.keys()) {
      const { hits } = await index.search<AlgoliaHit>(pkg);
      const firstMatch = hits.pop();
      if (firstMatch === undefined || !firstMatch.versions) {
        console.error(
          `Attempted to fetch version list for ${pkg} from Algolia but failed!`,
        );
        return;
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
  };
}
