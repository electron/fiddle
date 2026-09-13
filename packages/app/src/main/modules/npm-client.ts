/**
 * npm search (Algolia's public npm index) and version lists (the npm
 * registry). No Electron imports: main passes `net.fetch`, tests pass a stub
 * or point the endpoints at the fixture server.
 */
import * as semver from 'semver';

import { isValidPackageName, pickLatestVersion } from '../../fiddle/modules';
import { ErrorCode, FiddleError } from '../../shared/errors';

export interface PackageSearchResult {
  name: string;
  version: string;
  description: string;
}

export interface PackageVersionList {
  /** The `latest` dist-tag, or the newest stable version. Null if there are none. */
  latest: string | null;
  /** Every published version, newest first. */
  versions: string[];
}

export interface NpmEndpoints {
  /** Algolia query endpoint for the `npm-search` index. */
  searchUrl: string;
  /** npm registry root, without a trailing slash. */
  registryUrl: string;
}

export const DEFAULT_NPM_ENDPOINTS: NpmEndpoints = {
  searchUrl: 'https://OFCNCOG2CU-dsn.algolia.net/1/indexes/npm-search/query',
  registryUrl: 'https://registry.npmjs.org',
};

/** The npm endpoints from the app's endpoint set (src/shared/endpoints.ts). */
export function npmEndpoints(base: { algolia: string; npmRegistry: string }): NpmEndpoints {
  return {
    searchUrl: `${base.algolia}/1/indexes/npm-search/query`,
    registryUrl: base.npmRegistry,
  };
}

// Algolia's public, search-only credentials for its npm index (the same ones
// Fiddle has always shipped).
const ALGOLIA_APP_ID = 'OFCNCOG2CU';
const ALGOLIA_API_KEY = '4efa2042cf4dba11be6e96e5c394e1a4';

export const SEARCH_LIMIT = 5;
const VERSIONS_TTL_MS = 5 * 60_000;
const CACHE_SIZE = 100;

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface NpmClientOptions {
  fetch: FetchFn;
  endpoints?: Partial<NpmEndpoints>;
  now?: () => number;
}

interface AlgoliaHit {
  name?: unknown;
  version?: unknown;
  description?: unknown;
}

/**
 * Keeps Algolia's order, but an exact (case-insensitive) name match always
 * comes first. Drops malformed and duplicate hits and returns at most `limit`.
 */
export function rankSearchHits(
  query: string,
  hits: readonly AlgoliaHit[],
  limit = SEARCH_LIMIT,
): PackageSearchResult[] {
  const wanted = query.trim().toLowerCase();
  const seen = new Set<string>();
  const results: PackageSearchResult[] = [];
  for (const hit of hits) {
    if (typeof hit.name !== 'string' || typeof hit.version !== 'string') continue;
    if (seen.has(hit.name)) continue;
    seen.add(hit.name);
    results.push({
      name: hit.name,
      version: hit.version,
      description: typeof hit.description === 'string' ? hit.description : '',
    });
  }
  const exact = results.findIndex((result) => result.name.toLowerCase() === wanted);
  if (exact > 0) results.unshift(...results.splice(exact, 1));
  return results.slice(0, limit);
}

/** Every valid version, newest first, plus `latest` (the dist-tag or the newest stable). */
export function toVersionList(
  versions: readonly string[],
  latestTag: string | undefined,
): PackageVersionList {
  const valid = versions.filter((version) => semver.valid(version) !== null);
  valid.sort(semver.rcompare);
  const latest =
    latestTag && valid.includes(latestTag) ? latestTag : (pickLatestVersion(valid) ?? valid[0]);
  return { latest: latest ?? null, versions: valid };
}

/** A small map that forgets its oldest entry once it's full. */
class Cache<T> {
  readonly #entries = new Map<string, { value: T; at: number }>();
  constructor(readonly size: number) {}

  get(key: string, now: number, ttl = Infinity): T | undefined {
    const entry = this.#entries.get(key);
    if (!entry || now - entry.at > ttl) return undefined;
    return entry.value;
  }

  set(key: string, value: T, now: number): void {
    this.#entries.delete(key);
    this.#entries.set(key, { value, at: now });
    if (this.#entries.size > this.size) {
      const oldest = this.#entries.keys().next().value;
      if (oldest !== undefined) this.#entries.delete(oldest);
    }
  }
}

export class NpmClient {
  readonly #fetch: FetchFn;
  readonly #endpoints: NpmEndpoints;
  readonly #now: () => number;
  readonly #searches = new Cache<PackageSearchResult[]>(CACHE_SIZE);
  readonly #versions = new Cache<PackageVersionList>(CACHE_SIZE);

  constructor(options: NpmClientOptions) {
    this.#fetch = options.fetch;
    this.#endpoints = { ...DEFAULT_NPM_ENDPOINTS, ...options.endpoints };
    this.#now = options.now ?? Date.now;
  }

  /** The top 5 packages for `query`, with an exact name match first. */
  async search(query: string): Promise<PackageSearchResult[]> {
    const trimmed = query.trim();
    if (trimmed === '') return [];
    const cached = this.#searches.get(trimmed, this.#now());
    if (cached) return cached;

    const body = (await this.#request(this.#endpoints.searchUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-algolia-application-id': ALGOLIA_APP_ID,
        'x-algolia-api-key': ALGOLIA_API_KEY,
      },
      body: JSON.stringify({
        query: trimmed,
        hitsPerPage: SEARCH_LIMIT,
        // Boosts the package whose name is exactly the query.
        optionalFilters: [`objectID:${trimmed}`],
        attributesToRetrieve: ['name', 'version', 'description'],
        attributesToHighlight: [],
      }),
    })) as { hits?: unknown };

    const hits = Array.isArray(body.hits) ? (body.hits as AlgoliaHit[]) : [];
    const results = rankSearchHits(trimmed, hits);
    this.#searches.set(trimmed, results, this.#now());
    return results;
  }

  /** Every published version of `name`, newest first. */
  async versions(name: string): Promise<PackageVersionList> {
    if (!isValidPackageName(name)) {
      throw new FiddleError(ErrorCode.invalidArgument, `Invalid package name: ${name}`, { name });
    }
    const cached = this.#versions.get(name, this.#now(), VERSIONS_TTL_MS);
    if (cached) return cached;

    // Scoped names keep their `@` and escape the slash: `@scope%2Fname`.
    const url = `${this.#endpoints.registryUrl}/${name.replace('/', '%2F')}`;
    const body = (await this.#request(url, {
      // The abbreviated document: versions and dist-tags without READMEs.
      headers: { accept: 'application/vnd.npm.install-v1+json' },
    }, name)) as { versions?: unknown; 'dist-tags'?: { latest?: unknown } };

    const versions =
      body.versions && typeof body.versions === 'object' ? Object.keys(body.versions) : [];
    const latestTag = body['dist-tags']?.latest;
    const list = toVersionList(versions, typeof latestTag === 'string' ? latestTag : undefined);
    this.#versions.set(name, list, this.#now());
    return list;
  }

  /** The version a newly added module gets. */
  async latestVersion(name: string): Promise<string> {
    const { latest } = await this.versions(name);
    if (!latest) {
      throw new FiddleError(ErrorCode.notFound, `${name} has no published versions`, { name });
    }
    return latest;
  }

  async #request(url: string, init: RequestInit, packageName?: string): Promise<unknown> {
    let response: Response;
    try {
      response = await this.#fetch(url, init);
    } catch (error) {
      throw new FiddleError(ErrorCode.network, `Could not reach ${new URL(url).host}`, {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
    if (response.status === 404 && packageName !== undefined) {
      throw new FiddleError(ErrorCode.notFound, `${packageName} is not on npm`, {
        name: packageName,
      });
    }
    if (!response.ok) {
      throw new FiddleError(ErrorCode.network, `${new URL(url).host} answered ${response.status}`, {
        status: response.status,
      });
    }
    try {
      return await response.json();
    } catch {
      throw new FiddleError(ErrorCode.network, `${new URL(url).host} sent invalid JSON`);
    }
  }
}
