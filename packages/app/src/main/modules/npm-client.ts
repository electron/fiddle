import * as semver from 'semver';

import { isValidPackageName, pickLatestVersion } from '../../fiddle/modules';
import type { Endpoints } from '../../shared/endpoints';
import { ErrorCode, FiddleError } from '../../shared/errors';
import { tm } from '../i18n';

interface PackageSearchResult {
  name: string;
  version: string;
  description: string;
}

interface PackageVersionList {
  /** The `latest` dist-tag, or the newest stable version. Null if there are none. */
  latest: string | null;
  /** Every published version, newest first. */
  versions: string[];
}

/** From the app's endpoints: Algolia's origin and the npm registry root, without trailing slashes. */
type NpmEndpoints = Pick<Endpoints, 'algolia' | 'npmRegistry'>;

// Algolia's public, search-only credentials for its npm index.
const ALGOLIA_APP_ID = 'OFCNCOG2CU';
const ALGOLIA_API_KEY = '4efa2042cf4dba11be6e96e5c394e1a4';

const SEARCH_LIMIT = 5;
const VERSIONS_TTL_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 30_000;

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

interface NpmClientOptions {
  fetch: FetchFn;
  endpoints: NpmEndpoints;
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
    latestTag && valid.includes(latestTag)
      ? latestTag
      : (pickLatestVersion(valid) ?? valid[0]);
  return { latest: latest ?? null, versions: valid };
}

export class NpmClient {
  readonly #fetch: FetchFn;
  readonly #endpoints: NpmEndpoints;
  readonly #now: () => number;
  /** A session's searches and version lists are few and small, so both caches just grow. */
  readonly #searches = new Map<string, PackageSearchResult[]>();
  readonly #versions = new Map<string, { list: PackageVersionList; at: number }>();

  constructor(options: NpmClientOptions) {
    this.#fetch = options.fetch;
    this.#endpoints = options.endpoints;
    this.#now = options.now ?? Date.now;
  }

  /** The top 5 packages for `query`, with an exact name match first. */
  async search(query: string): Promise<PackageSearchResult[]> {
    const trimmed = query.trim();
    if (trimmed === '') return [];
    const cached = this.#searches.get(trimmed);
    if (cached) return cached;

    const searchUrl = `${this.#endpoints.algolia}/1/indexes/npm-search/query`;
    const body = (await this.#request(searchUrl, {
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
    this.#searches.set(trimmed, results);
    return results;
  }

  /** A package's registry metadata: the abbreviated document, with versions, dist-tags and `hasInstallScript`. Not cached. */
  async packument(name: string, signal?: AbortSignal): Promise<unknown> {
    if (!isValidPackageName(name)) {
      throw new FiddleError(
        ErrorCode.invalidArgument,
        tm('mainModules')('invalidPackageName', { name }),
        { name },
      );
    }
    // Scoped names keep their `@` and escape the slash: `@scope%2Fname`.
    const url = `${this.#endpoints.npmRegistry}/${name.replace('/', '%2F')}`;
    return this.#request(
      url,
      { headers: { accept: 'application/vnd.npm.install-v1+json' }, signal },
      name,
    );
  }

  async versions(name: string): Promise<PackageVersionList> {
    const cached = this.#versions.get(name);
    if (cached && this.#now() - cached.at <= VERSIONS_TTL_MS) return cached.list;

    const body = (await this.packument(name)) as {
      versions?: unknown;
      'dist-tags'?: { latest?: unknown };
    };

    const versions =
      body.versions && typeof body.versions === 'object'
        ? Object.keys(body.versions)
        : [];
    const latestTag = body['dist-tags']?.latest;
    const list = toVersionList(
      versions,
      typeof latestTag === 'string' ? latestTag : undefined,
    );
    this.#versions.set(name, { list, at: this.#now() });
    return list;
  }

  /** The version a newly added module gets. */
  async latestVersion(name: string): Promise<string> {
    const { latest } = await this.versions(name);
    if (!latest) {
      throw new FiddleError(
        ErrorCode.notFound,
        tm('mainModules')('noPublishedVersions', { name }),
        { name },
      );
    }
    return latest;
  }

  async #request(url: string, init: RequestInit, packageName?: string): Promise<unknown> {
    // The timeout also covers reading the body, so a stalled connection can't leave a call pending.
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    const t = tm('mainModules');
    const host = new URL(url).host;
    let response: Response;
    try {
      response = await this.#fetch(url, { ...init, signal });
    } catch (error) {
      if (init.signal?.aborted)
        throw new FiddleError(ErrorCode.cancelled, 'The request was cancelled');
      throw new FiddleError(ErrorCode.network, t('registryUnreachable', { host }), {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
    if (response.status === 404 && packageName !== undefined) {
      throw new FiddleError(ErrorCode.notFound, t('notOnNpm', { name: packageName }), {
        name: packageName,
      });
    }
    if (!response.ok) {
      throw new FiddleError(
        ErrorCode.network,
        t('registryStatus', { host, status: response.status }),
        { status: response.status },
      );
    }
    try {
      return await response.json();
    } catch {
      throw new FiddleError(ErrorCode.network, t('registryInvalidResponse', { host }));
    }
  }
}
