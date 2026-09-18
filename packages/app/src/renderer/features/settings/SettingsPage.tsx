/**
 * The settings page, shown in the sheet when `Window.view` is `settings`
 * Search filters every section by title, description and key; changed values
 * are marked and can be reset; settings.json can be opened, imported and
 * exported.
 */
import {
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  type ComponentType,
} from 'react';
import { useTranslation } from 'react-i18next';

import contributors from '../../../../static/contributors.json';
import { getReleaseChannel } from '../../../fiddle/versions';
import { locales } from '../../../i18n';
import {
  appApi,
  appPlatformApi,
  settingsApi,
  windowApi,
  type AppInfo,
} from '../../../ipc/renderer';
import { useWindowState } from '../../state';
import {
  BUILTIN_THEME,
  HIGH_CONTRAST_THEMES,
  MIRRORS,
  releaseChannelSchema,
  type Mirror,
  type SettingKey,
  type Settings,
} from '../../../shared/settings';
import {
  Button,
  Checkbox,
  Page,
  Radio,
  RadioGroup,
  SegmentedControl,
  Select,
  showToast,
  SideNav,
  TextField,
  type IconName,
  type SelectOption,
} from '../../../ui';
import { GitHubAccountSection } from '../gists/GitHubAccountSection';
import { VersionManager } from '../versions/VersionManager';
import { currentThemeSnapshot } from '../../shell/theme-snapshot';
import { setView } from '../../shell/window-state';
import {
  ListRow,
  matchesQuery,
  Row,
  SearchContext,
  SwitchRow,
  TextRow,
  useSettingText,
} from './controls';
import { KeybindingsSection } from './KeybindingsSection';
import { clearRequestedSection, useRequestedSection, type SectionId } from './sections';
import styles from './SettingsPage.module.css';
import { useSettings, useSettingsAction } from './use-settings';

/** Elements whose Escape belongs to an open menu, popover or dialog. */
const OVERLAY = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

interface SectionDef {
  id: SectionId;
  icon: IconName;
  /** The settings in the section, for search. */
  keys: readonly SettingKey[];
  body: ComponentType<{ showAll: boolean }>;
}

export function SettingsPage() {
  const { t } = useTranslation('settings');
  const run = useSettingsAction();
  const requested = useRequestedSection();
  const [current, setCurrent] = useState<SectionId>(requested ?? 'general');
  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';

  // A section asked for while the page is open is shown, and the request is forgotten.
  const [seen, setSeen] = useState(requested);
  if (requested !== seen) {
    setSeen(requested);
    if (requested) {
      setCurrent(requested);
      setQuery('');
    }
  }
  useEffect(() => {
    if (requested) clearRequestedSection();
  }, [requested]);

  // Escape closes settings wherever focus is, not only inside the page.
  // An open menu, popover or dialog gets it first: React Aria stops Escape there,
  // and a press in one, or on a control whose popup is open, is left alone.
  const close = useEffectEvent(() => void setView('editor', t('actionFailed')));
  useEffect(() => {
    let forOverlay = false;
    const onCapture = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      forOverlay =
        !!target &&
        (!!target.closest(OVERLAY) || target.getAttribute('aria-expanded') === 'true');
    };
    const onBubble = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !event.isComposing &&
        !forOverlay
      )
        close();
    };
    window.addEventListener('keydown', onCapture, true);
    window.addEventListener('keydown', onBubble);
    return () => {
      window.removeEventListener('keydown', onCapture, true);
      window.removeEventListener('keydown', onBubble);
    };
  }, []);

  // Pick up theme files added or edited outside the app.
  useEffect(() => {
    settingsApi.RefreshThemes().catch(() => undefined);
  }, []);

  const title = (id: SectionId) => t(`section.${id}`);
  const rowMatches = (key: SettingKey) =>
    matchesQuery(query, t(`${key}.title`), t(`${key}.description`), key);
  const shown = searching
    ? SECTIONS.filter(
        (section) =>
          matchesQuery(query, title(section.id)) || section.keys.some(rowMatches),
      )
    : SECTIONS.filter((section) => section.id === current);

  const nav = (
    <div className={styles.aside}>
      <TextField
        size="sm"
        icon="search"
        aria-label={t('search')}
        placeholder={t('search')}
        value={query}
        onChange={setQuery}
      />
      <SideNav
        aria-label={t('navLabel')}
        items={SECTIONS.map((section) => ({
          id: section.id,
          label: title(section.id),
          icon: section.icon,
        }))}
        value={searching ? '' : current}
        onChange={(id) => {
          setQuery('');
          setCurrent(id as SectionId);
        }}
      />
      <div className={styles.actions}>
        <Button
          size="sm"
          variant="ghost"
          icon="file"
          onPress={() => run(() => settingsApi.OpenSettingsFile())}
        >
          {t('openFile')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon="download"
          onPress={() => run(() => settingsApi.ImportSettings())}
        >
          {t('import')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon="upload"
          onPress={() => run(() => settingsApi.ExportSettings())}
        >
          {t('export')}
        </Button>
      </div>
    </div>
  );

  return (
    <Page
      title={t('title')}
      nav={nav}
      onClose={() => void setView('editor', t('actionFailed'))}
      closeLabel={t('close')}
      closeHint={t('closeHint')}
    >
      {shown.length === 0 && <p className={styles.empty}>{t('noResults', { query })}</p>}
      {shown.map(({ id, body: Body }) => {
        const showAll = !searching || matchesQuery(query, title(id));
        return (
          <section
            key={id}
            className={styles.section}
            aria-labelledby={`settings-section-${id}`}
          >
            <h2 id={`settings-section-${id}`} className={styles.sectionTitle}>
              {title(id)}
            </h2>
            <SearchContext.Provider value={{ query, showAll }}>
              <Body showAll={showAll} />
            </SearchContext.Provider>
          </section>
        );
      })}
    </Page>
  );
}

function GeneralSection() {
  const { t } = useTranslation('settings');
  const { app, settings, set } = useSettings();
  const run = useSettingsAction();
  const themes = app?.themes ?? [];
  const custom = themes.find((theme) => theme.id === settings.theme);
  const highContrastNames: Record<string, string> = {
    [HIGH_CONTRAST_THEMES.dark]: t('theme.highContrastDark'),
    [HIGH_CONTRAST_THEMES.light]: t('theme.highContrastLight'),
  };
  // A custom or high-contrast theme sets light or dark itself.
  const fixedBy = custom?.name ?? highContrastNames[settings.theme];

  const changeLocale = async (id: string) => {
    if (id === settings.locale || !(await set('locale', id))) return;
    // The editor's own strings and Chromium's follow after a relaunch.
    showToast({
      title: t('locale.relaunchTitle'),
      description: t('locale.relaunchDescription'),
      actionLabel: t('locale.relaunch'),
      onAction: () => run(() => appPlatformApi.Relaunch()),
    });
  };

  const themeItems: SelectOption[] = [
    { id: BUILTIN_THEME, label: t('theme.lucent') },
    { id: HIGH_CONTRAST_THEMES.dark, label: t('theme.highContrastDark') },
    { id: HIGH_CONTRAST_THEMES.light, label: t('theme.highContrastLight') },
    ...themes.map((theme) => ({
      id: theme.id,
      label: theme.name,
      hint: t(theme.isDark ? 'theme.dark' : 'theme.light'),
    })),
  ];
  if (!themeItems.some((item) => item.id === settings.theme)) {
    themeItems.push({ id: settings.theme, label: settings.theme });
  }

  const names = new Intl.DisplayNames([app?.locale ?? 'en'], { type: 'language' });
  // `of` throws for a tag that isn't well formed, which a hand-edited settings.json can hold.
  const languageName = (code: string) => {
    try {
      return names.of(code) ?? code;
    } catch {
      return code;
    }
  };
  const localeItems: SelectOption[] = [
    { id: 'system', label: t('locale.system') },
    ...locales.map((code) => ({ id: code, label: languageName(code) })),
  ];
  if (!localeItems.some((item) => item.id === settings.locale)) {
    localeItems.push({ id: settings.locale, label: languageName(settings.locale) });
  }

  return (
    <>
      <Row
        setting="appearance"
        note={fixedBy ? t('appearance.fromTheme', { theme: fixedBy }) : undefined}
      >
        <SegmentedControl
          label={t('appearance.title')}
          options={(['system', 'light', 'dark'] as const).map((value) => ({
            value,
            label: t(`appearance.${value}`),
          }))}
          value={settings.appearance}
          isDisabled={fixedBy !== undefined}
          onChange={(value) => set('appearance', value as Settings['appearance'])}
        />
      </Row>
      <Row setting="theme">
        <div className={styles.stack}>
          <Select
            className={styles.field}
            aria-label={t('theme.title')}
            items={themeItems}
            value={settings.theme}
            onChange={(id) => set('theme', id)}
          />
          <div className={styles.buttons}>
            <Button size="sm" onPress={() => run(() => settingsApi.ImportTheme())}>
              {t('theme.importMonaco')}
            </Button>
            <Button
              size="sm"
              onPress={() =>
                run(() => settingsApi.CreateTheme(custom ? null : currentThemeSnapshot()))
              }
            >
              {t('theme.create')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon="folder"
              onPress={() => run(() => settingsApi.OpenThemesFolder())}
            >
              {t('theme.openFolder')}
            </Button>
          </div>
        </div>
      </Row>
      <Row setting="locale">
        <Select
          className={styles.field}
          aria-label={t('locale.title')}
          items={localeItems}
          value={settings.locale}
          onChange={changeLocale}
        />
      </Row>
      <SwitchRow setting="sessionRestore" />
      <SwitchRow setting="notifications" />
    </>
  );
}

function EditorSection() {
  const { t } = useTranslation('settings');
  const run = useSettingsAction();
  return (
    <>
      <TextRow
        setting="editorFontFamily"
        invalidMessage={t('editorFontFamily.invalid')}
      />
      <TextRow setting="editorFontSize" invalidMessage={t('editorFontSize.invalid')} />
      {/* Font changes apply after a reload. */}
      <div className={styles.row} data-inline>
        <div className={styles.rowText}>
          <p className={styles.rowDescription}>{t('editorFont.reloadHint')}</p>
        </div>
        <div className={styles.rowControl}>
          <Button
            size="sm"
            onPress={() => run(() => windowApi.RunCommand('view.reloadAllWindows'))}
          >
            {t('editorFont.reload')}
          </Button>
        </div>
      </div>
    </>
  );
}

function ExecutionSection() {
  const { t } = useTranslation('settings');
  const { settings, set } = useSettings();
  return (
    <>
      <ListRow setting="electronFlags" />
      <ListRow
        setting="environmentVariables"
        invalidMessage={t('environmentVariables.invalid')}
      />
      <Row setting="packageManager">
        <SegmentedControl
          label={t('packageManager.title')}
          options={[
            { value: 'npm', label: 'npm' },
            { value: 'yarn', label: 'yarn' },
          ]}
          value={settings.packageManager}
          onChange={(value) => set('packageManager', value as Settings['packageManager'])}
        />
      </Row>
      <SwitchRow setting="socketFirewall" />
      <SwitchRow setting="clearConsoleOnRun" />
      <SwitchRow setting="keepUserDataDirs" />
      <SwitchRow setting="electronLogging" />
    </>
  );
}

const CHANNELS = releaseChannelSchema.options;
const MIRROR_OPTIONS: readonly Mirror[] = ['auto', 'default', 'china', 'custom'];

function ElectronSection({ showAll }: { showAll: boolean }) {
  const { t } = useTranslation('settings');
  const { settings, set } = useSettings();
  const ref = useWindowState()?.fiddle.versionRef;
  // The current version's channel can't be turned off.
  const currentChannel =
    ref?.kind === 'release' ? getReleaseChannel(ref.version) : undefined;

  return (
    <>
      <Row setting="channels">
        <div className={styles.inlineGroup}>
          {CHANNELS.map((channel) => {
            const selected = settings.channels.includes(channel);
            return (
              <Checkbox
                key={channel}
                isSelected={selected}
                isDisabled={selected && channel === currentChannel}
                onChange={(on) =>
                  set(
                    'channels',
                    CHANNELS.filter((c) =>
                      c === channel ? on : settings.channels.includes(c),
                    ),
                  )
                }
              >
                {t(`channel.${channel}`)}
              </Checkbox>
            );
          })}
        </div>
      </Row>
      <SwitchRow setting="showNotDownloaded" />
      <SwitchRow setting="showObsolete" />
      <Row setting="mirror">
        <RadioGroup
          aria-label={t('mirror.title')}
          orientation="horizontal"
          value={settings.mirror}
          onChange={(value) => set('mirror', value as Mirror)}
        >
          {MIRROR_OPTIONS.map((mirror) => (
            <Radio key={mirror} value={mirror}>
              {t(`mirror.${mirror}`)}
            </Radio>
          ))}
        </RadioGroup>
      </Row>
      {settings.mirror === 'custom' && (
        <>
          <TextRow
            setting="customMirrorElectron"
            mono
            placeholder={MIRRORS.default.electron}
            invalidMessage={t('mirror.invalidUrl')}
          />
          <TextRow
            setting="customMirrorNightly"
            mono
            placeholder={MIRRORS.default.nightly}
            invalidMessage={t('mirror.invalidUrl')}
          />
        </>
      )}
      {showAll && <VersionManager />}
    </>
  );
}

function GitHubSection({ showAll }: { showAll: boolean }) {
  const { t } = useTranslation('settings');
  const { settings, set } = useSettings();
  const { query } = useContext(SearchContext);
  // The account section also holds "Publish as a revision".
  const revision = useSettingText('gistPublishAsRevision');
  return (
    <>
      {(showAll ||
        matchesQuery(
          query,
          revision.title,
          revision.description,
          'gistPublishAsRevision',
        )) && <GitHubAccountSection />}
      <TextRow setting="packageAuthor" invalidMessage={t('packageAuthor.description')} />
      <SwitchRow setting="gistShowHistory" />
      <Row setting="gistVisibility">
        <SegmentedControl
          label={t('gistVisibility.title')}
          options={(['secret', 'public'] as const).map((value) => ({
            value,
            label: t(`gistVisibility.${value}`),
          }))}
          value={settings.gistVisibility}
          onChange={(value) => set('gistVisibility', value as Settings['gistVisibility'])}
        />
      </Row>
    </>
  );
}

function AccessibilitySection() {
  const { t } = useTranslation('settings');
  const { app, settings, set } = useSettings();
  return (
    <Row
      setting="screenReader"
      note={t(app?.screenReaderActive ? 'screenReader.active' : 'screenReader.inactive')}
    >
      <SegmentedControl
        label={t('screenReader.title')}
        options={(['auto', 'on', 'off'] as const).map((value) => ({
          value,
          label: t(`screenReader.${value}`),
        }))}
        value={settings.screenReader}
        onChange={(value) => set('screenReader', value as Settings['screenReader'])}
      />
    </Row>
  );
}

function AboutSection() {
  const { t } = useTranslation('settings');
  const [info, setInfo] = useState<AppInfo>();
  useEffect(() => {
    appApi.GetAppInfo().then(setInfo, () => undefined);
  }, []);

  return (
    <>
      {info && (
        <div className={styles.about}>
          <h3 className={styles.subTitle}>{info.name}</h3>
          <p className={styles.muted}>{t('about.version', { version: info.version })}</p>
          <p className={styles.muted}>
            {t('about.electron', { version: info.electronVersion })}
          </p>
        </div>
      )}
      <h3 className={styles.subTitle}>{t('about.contributors')}</h3>
      <ul className={styles.contributors}>
        {contributors.contributors.map((person) => (
          <li key={person.login}>
            <a href={person.url} target="_blank" rel="noreferrer">
              {person.login}
            </a>
            <span className={styles.count}>
              {t('about.contributions', { count: person.contributions })}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Crash reports, and on macOS "Reset privacy permissions". */
function PrivacySection() {
  const { t } = useTranslation('settings');
  const { app } = useSettings();
  const run = useSettingsAction();
  const { query, showAll } = useContext(SearchContext);
  const title = t('privacyReset.title');
  const description = t('privacyReset.description');
  const showReset =
    app?.platform === 'darwin' && (showAll || matchesQuery(query, title, description));
  const reset = async () => {
    if (await appPlatformApi.ResetPrivacyPermissions())
      showToast({ tone: 'success', title: t('privacyReset.done') });
  };
  return (
    <>
      <SwitchRow setting="crashReports" />
      {showReset && (
        <div className={styles.row} data-inline>
          <div className={styles.rowText}>
            <div className={styles.rowHead}>
              <span className={styles.rowTitle}>{title}</span>
            </div>
            <p className={styles.rowDescription}>{description}</p>
          </div>
          <div className={styles.rowControl}>
            <Button size="sm" onPress={() => run(reset)}>
              {t('privacyReset.button')}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

const SECTIONS: readonly SectionDef[] = [
  {
    id: 'general',
    icon: 'settings',
    keys: ['appearance', 'theme', 'locale', 'sessionRestore', 'notifications'],
    body: GeneralSection,
  },
  {
    id: 'editor',
    icon: 'code',
    keys: ['editorFontFamily', 'editorFontSize'],
    body: EditorSection,
  },
  {
    id: 'execution',
    icon: 'play',
    keys: [
      'electronFlags',
      'environmentVariables',
      'packageManager',
      'socketFirewall',
      'clearConsoleOnRun',
      'keepUserDataDirs',
      'electronLogging',
    ],
    body: ExecutionSection,
  },
  {
    id: 'electron',
    icon: 'download',
    keys: [
      'channels',
      'showNotDownloaded',
      'showObsolete',
      'mirror',
      'customMirrorElectron',
      'customMirrorNightly',
    ],
    body: ElectronSection,
  },
  {
    id: 'github',
    icon: 'user',
    keys: ['gistPublishAsRevision', 'packageAuthor', 'gistShowHistory', 'gistVisibility'],
    body: GitHubSection,
  },
  {
    id: 'keybindings',
    icon: 'keyboard',
    keys: ['keybindings'],
    body: KeybindingsSection,
  },
  {
    id: 'accessibility',
    icon: 'eye',
    keys: ['screenReader'],
    body: AccessibilitySection,
  },
  { id: 'privacy', icon: 'lock', keys: ['crashReports'], body: PrivacySection },
  { id: 'about', icon: 'info', keys: [], body: AboutSection },
];
