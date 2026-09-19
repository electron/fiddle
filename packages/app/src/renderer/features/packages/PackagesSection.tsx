import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ComboBox, Input, ListBox, ListBoxItem, Popover } from 'react-aria-components';

import { modulesApi } from '../../../ipc/renderer';
import type { PackageSearchResults, PackageVersions } from '../../../shared/stores';
import { cx, Icon, IconButton } from '../../../ui';
import field from '../../../ui/components/Field.module.css';
import menu from '../../../ui/components/Menu.module.css';
import { addModule } from '../../shell/window-state';
import { useWindowState } from '../../state';
import { toastError } from '../../toast-error';
import { SearchSelect, type SearchOption } from '../versions/SearchSelect';
import { highlightParts } from './highlight';
import styles from './PackagesSection.module.css';

const SEARCH_DEBOUNCE_MS = 250;
/** The version menu searches every version but renders this many matches at most, so packages with thousands stay fast. */
const MAX_LISTED = 150;

type SearchStatus = 'idle' | 'loading' | 'done' | 'error';

/** How long a version list is reused; main's npm client caches for the same time. */
const VERSIONS_TTL_MS = 5 * 60_000;

const versionRequests = new Map<
  string,
  { at: number; request: Promise<PackageVersions> }
>();

export function loadVersions(name: string): Promise<PackageVersions> {
  const cached = versionRequests.get(name);
  if (cached && Date.now() - cached.at < VERSIONS_TTL_MS) return cached.request;
  const request = modulesApi.GetPackageVersions(name);
  versionRequests.set(name, { at: Date.now(), request });
  request.catch(() => {
    if (versionRequests.get(name)?.request === request) versionRequests.delete(name);
  });
  return request;
}

/** The versions a module's menu lists for `query`: matches newest first, capped, with the current one kept. */
export function listedVersions(
  all: readonly string[],
  current: string,
  query: string,
  limit = MAX_LISTED,
): { listed: string[]; total: number } {
  const needle = query.trim().toLowerCase();
  const matches = needle ? all.filter((v) => v.toLowerCase().includes(needle)) : all;
  const listed = matches.slice(0, limit);
  if (!needle && !listed.includes(current)) listed.unshift(current);
  return { listed, total: matches.length };
}

function PackageSearch() {
  const { t } = useTranslation('packages');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PackageSearchResults>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const latest = useRef(0);

  const onInputChange = (value: string) => {
    setQuery(value);
    if (value.trim() === '') {
      setResults([]);
      setStatus('idle');
    } else {
      setStatus('loading');
    }
  };

  useEffect(() => {
    const trimmed = query.trim();
    const request = ++latest.current;
    if (trimmed === '') return;
    const timer = setTimeout(() => {
      modulesApi.SearchPackages(trimmed).then(
        (found) => {
          if (request !== latest.current) return;
          setResults(found);
          setStatus('done');
        },
        () => {
          if (request !== latest.current) return;
          setResults([]);
          setStatus('error');
        },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const add = (name: string) => {
    const hit = results.find((result) => result.name === name);
    onInputChange('');
    void addModule(name, hit?.version ?? null, t('addFailed', { name }));
  };

  const empty =
    status === 'loading'
      ? t('searching')
      : status === 'error'
        ? t('searchFailed')
        : t('noResults');

  return (
    <div className={field.root} data-size="sm" data-glass>
      <ComboBox
        aria-label={t('addLabel')}
        inputValue={query}
        onInputChange={onInputChange}
        items={results}
        selectedKey={null}
        onSelectionChange={(key) => key !== null && add(String(key))}
        menuTrigger="input"
        // Only while there's a query, so the suggestions close once a package is added (which clears it).
        allowsEmptyCollection={query.trim() !== ''}
        allowsCustomValue
      >
        <div className={field.field}>
          <Icon name="search" size={14} className={field.icon} />
          <Input
            className={field.input}
            placeholder={t('addPlaceholder')}
            onKeyDown={(event) => {
              // With no suggestion highlighted, Enter commits the typed text as a custom value and never selects.
              const typed = query.trim();
              if (
                event.key === 'Enter' &&
                typed &&
                !event.nativeEvent.isComposing &&
                !event.currentTarget.hasAttribute('aria-activedescendant')
              )
                add(typed);
            }}
          />
        </div>
        <Popover className={menu.popover} placement="bottom start" offset={4}>
          <ListBox<PackageSearchResults[number]>
            className={menu.surface}
            renderEmptyState={() => <div className={styles.empty}>{empty}</div>}
          >
            {(result) => (
              <ListBoxItem
                id={result.name}
                textValue={result.name}
                className={cx(menu.item, styles.result)}
              >
                <span className={menu.lead}>
                  <Icon name="package" />
                </span>
                <span className={menu.label}>
                  {highlightParts(result.name, query).map((part, i) =>
                    part.match ? (
                      <mark key={i} className={styles.match}>
                        {part.text}
                      </mark>
                    ) : (
                      part.text
                    ),
                  )}
                </span>
                <span className={menu.hint}>{result.version}</span>
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </ComboBox>
    </div>
  );
}

// Memoized: a store push re-renders the sidebar, and each row's version menu builds a hidden collection.
const ModuleRow = memo(function ModuleRow({
  name,
  version,
}: {
  name: string;
  version: string;
}) {
  const { t } = useTranslation('packages');
  const [versions, setVersions] = useState<PackageVersions | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let live = true;
    loadVersions(name).then(
      (list) => live && setVersions(list),
      // The menu then lists only the current version.
      () => {},
    );
    return () => {
      live = false;
    };
  }, [name]);

  const { groups, total } = useMemo(() => {
    const { listed, total } = listedVersions(versions?.versions ?? [], version, query);
    const options: SearchOption[] = listed.map((v) => ({
      id: v,
      label: v,
      ...(v === versions?.latest ? { hint: t('latest') } : {}),
    }));
    return { groups: [{ options }], total };
  }, [versions, version, query, t]);
  const shown = Math.min(total, MAX_LISTED);

  const failed = (error: unknown) => toastError(error, t('changeFailed', { name }));

  return (
    <li className={styles.row}>
      <Icon name="package" className={styles.icon} />
      <span className={styles.name} title={name}>
        {name}
      </span>
      <SearchSelect
        aria-label={t('version', { name })}
        size="sm"
        groups={groups}
        value={version}
        placeholder={version}
        query={query}
        onQueryChange={setQuery}
        searchLabel={t('searchVersions')}
        emptyLabel={t('noVersions')}
        {...(total > shown ? { note: t('moreVersions', { shown, total }) } : {})}
        onChange={(next) => {
          if (next !== version) modulesApi.SetModuleVersion(name, next).catch(failed);
        }}
        className={styles.version}
      />
      <IconButton
        icon="close"
        size="sm"
        variant="ghost"
        label={t('remove', { name })}
        onPress={() => {
          modulesApi.RemoveModule(name).catch(failed);
        }}
      />
    </li>
  );
});

export function PackagesSection() {
  const { t } = useTranslation('packages');
  const win = useWindowState();
  const titleId = useId();
  const modules = win ? Object.entries(win.fiddle.modules) : [];

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.head}>
        {t('title')}
      </h2>
      <PackageSearch />
      {modules.length > 0 && (
        <ul className={styles.list} aria-label={t('list')}>
          {modules.map(([name, version]) => (
            <ModuleRow key={name} name={name} version={version} />
          ))}
        </ul>
      )}
    </section>
  );
}
