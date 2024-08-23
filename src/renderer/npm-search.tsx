import { SearchResponse } from '@algolia/client-search';
import algoliasearch, { SearchIndex } from 'algoliasearch/lite';

// See full schema: https://github.com/algolia/npm-search#schema
export interface NPMSearchResult {
  name: string;
  version: string;
  versions: Record<string, string>;
  _highlightResult: {
    name: {
      value: string;
    };
  };
}

class NPMSearch {
  private index: SearchIndex;
  private searchCache: Map<string, SearchResponse<NPMSearchResult>>;
  constructor() {
    const client = algoliasearch(
      'OFCNCOG2CU',
      '4efa2042cf4dba11be6e96e5c394e1a4',
    );
    this.index = client.initIndex('npm-search');
    this.searchCache = new Map();
  }

  /**
   * Finds a list of packages Algolia's npm search index.
   * Naively caches all queries client-side.
   */
  async search(query: string) {
    if (this.searchCache.has(query)) {
      return this.searchCache.get(query)!;
    } else {
      const result = await this.index.search<NPMSearchResult>(query, {
        hitsPerPage: 5,
        optionalFilters: [`objectID:${query}`],
      });
      this.searchCache.set(query, result);
      return result;
    }
  }
}

const npmSearch = new NPMSearch();
export { npmSearch };
