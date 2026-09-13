/**
 * The sidebar's Packages section: an "Add a package" field that searches npm
 * (debounced, top 5, matches highlighted), then one row per module with a
 * version menu and a remove button. Modules live in `Window.fiddle.modules`;
 * every change goes through the `Modules` methods in main.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ComboBox, Input, ListBox, ListBoxItem, Popover, type Key } from 'react-aria-components';

import { modulesApi, useWindowStore } from '../../../ipc/renderer';
import type { PackageSearchResults, PackageVersions } from '../../../shared/stores';
import { cx, Icon, IconButton, Select, showToast, type SelectOption } from '../../../ui';
import field from '../../../ui/components/Field.module.css';
import menu from '../../../ui/components/Menu.module.css';
import { highlightParts } from './highlight';
import styles from './PackagesSection.module.css';

const SEARCH_DEBOUNCE_MS = 250;
/** Enough history for the version menu without rendering thousands of rows. */
const MAX_VERSIONS = 150;

type SearchStatus = 'idle' | 'loading' | 'done' | 'error';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Shared across rows and remounts; main caches too, this just avoids repeat IPC. */
const versionRequests = new Map<string, Promise<PackageVersions>>();

function loadVersions(name: string): Promise<PackageVersions> {
  let request = versionRequests.get(name);
  if (!request) {
    request = modulesApi.GetPackageVersions(name);
    versionRequests.set(name, request);
    request.catch(() => versionRequests.delete(name));
  }
  return request;
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

  const add = (key: Key | null) => {
    if (key === null) return;
    const name = String(key);
    onInputChange('');
    modulesApi.AddModule(name, null).catch((error: unknown) => {
      showToast({ title: t('addFailed', { name }), description: errorText(error), tone: 'error' });
    });
  };

  const empty =
    status === 'loading' ? t('searching') : status === 'error' ? t('searchFailed') : t('noResults');

  return (
    <div className={field.root} data-size="sm" data-glass>
      <ComboBox
        aria-label={t('addLabel')}
        inputValue={query}
        onInputChange={onInputChange}
        items={results}
        selectedKey={null}
        onSelectionChange={add}
        menuTrigger="input"
        allowsEmptyCollection
        allowsCustomValue
      >
        <div className={field.field}>
          <Icon name="search" size={14} className={field.icon} />
          <Input className={field.input} placeholder={t('addPlaceholder')} />
        </div>
        <Popover className={menu.popover} placement="bottom start" offset={4}>
          <ListBox<PackageSearchResults[number]>
            className={menu.surface}
            renderEmptyState={() => <div className={styles.empty}>{empty}</div>}
          >
            {(result) => (
              <ListBoxItem id={result.name} textValue={result.name} className={cx(menu.item, styles.result)}>
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

function ModuleRow({ name, version }: { name: string; version: string }) {
  const { t } = useTranslation('packages');
  const [versions, setVersions] = useState<PackageVersions | null>(null);

  useEffect(() => {
    let live = true;
    loadVersions(name).then(
      (list) => live && setVersions(list),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [name]);

  const listed = versions?.versions.slice(0, MAX_VERSIONS) ?? [];
  if (!listed.includes(version)) listed.unshift(version);
  const items: SelectOption[] = listed.map((v) => ({
    id: v,
    label: v,
    hint: v === versions?.latest ? t('latest') : undefined,
  }));

  const failed = (error: unknown) =>
    showToast({ title: t('changeFailed', { name }), description: errorText(error), tone: 'error' });

  return (
    <li className={styles.row}>
      <Icon name="package" className={styles.icon} />
      <span className={styles.name} title={name}>
        {name}
      </span>
      <Select
        aria-label={t('version', { name })}
        size="sm"
        items={items}
        value={version}
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
}

export function PackagesSection() {
  const { t } = useTranslation('packages');
  const win = useWindowStore();
  const modules = win.state === 'ready' ? Object.entries(win.result.fiddle.modules) : [];

  return (
    <section className={styles.section} aria-labelledby="packages-title" data-tour="packages">
      <h2 id="packages-title" className={styles.head}>
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
