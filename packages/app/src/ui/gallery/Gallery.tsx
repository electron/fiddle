/* The Lucent gallery: every component in every state that can be shown at rest.
   Hover, press and focus are live. Dev tool only: the sample text is specimen copy,
   not app strings. */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  confirmDialog,
  Dialog,
  DialogHost,
  DialogSurface,
  EmptyState,
  FormField,
  Icon,
  IconButton,
  iconNames,
  InlineCode,
  Kbd,
  List,
  ListRow,
  Menu,
  MenuItem,
  MenuPopover,
  MenuSection,
  MenuSeparator,
  MenuTrigger,
  Page,
  Popover,
  PopoverTrigger,
  ProgressBar,
  ProgressRing,
  promptDialog,
  Radio,
  RadioGroup,
  SegmentedControl,
  Select,
  showToast,
  SideNav,
  Spinner,
  SplitHandle,
  StatusPill,
  Switch,
  Tab,
  Table,
  TabList,
  TabPanel,
  Tabs,
  Tag,
  TextField,
  Toast,
  Toaster,
  ToolbarButton,
  ToolbarCapsule,
  Tooltip,
  Tree,
  TreeRow,
  type SelectItems,
  type TableColumn,
  type TableSection,
} from '../index';
import styles from './Gallery.module.css';

type Appearance = 'dark' | 'light';

const VERSIONS: SelectItems = [
  {
    title: 'Stable',
    options: [
      { id: '43.0.0', label: 'Electron 43.0.0', hint: 'latest' },
      { id: '42.4.1', label: 'Electron 42.4.1' },
      { id: '41.6.2', label: 'Electron 41.6.2' },
    ],
  },
  {
    title: 'Pre-release',
    options: [
      { id: '44.0.0-beta.3', label: 'Electron 44.0.0-beta.3', hint: 'beta' },
      { id: '45.0.0-nightly', label: 'Electron 45.0.0-nightly', hint: 'nightly' },
    ],
  },
];

interface VersionRow {
  id: string;
  channel: string;
  state: 'installed' | 'remote' | 'downloading';
  size: string;
}

const TABLE_ROWS: Array<VersionRow | TableSection> = [
  { section: 'Stable' },
  { id: '43.0.0', channel: 'Stable', state: 'installed', size: '104 MB' },
  { id: '42.4.1', channel: 'Stable', state: 'installed', size: '102 MB' },
  { id: '41.6.2', channel: 'Stable', state: 'remote', size: '99 MB' },
  { section: 'Beta' },
  { id: '44.0.0-beta.3', channel: 'Beta', state: 'downloading', size: '106 MB' },
  { id: '44.0.0-beta.2', channel: 'Beta', state: 'remote', size: '106 MB' },
];

const TABLE_COLUMNS: TableColumn<VersionRow>[] = [
  { key: 'id', label: 'Version', mono: true },
  { key: 'channel', label: 'Channel', width: '90px' },
  {
    key: 'state',
    label: 'Status',
    render: (row) =>
      row.state === 'installed' ? (
        <Badge tone="success">Downloaded</Badge>
      ) : row.state === 'downloading' ? (
        <span className={styles.inline}>
          <ProgressRing value={62} /> Downloading 62%
        </span>
      ) : (
        <span className={styles.muted}>Not downloaded</span>
      ),
  },
  { key: 'size', label: 'Size', mono: true, align: 'right', width: '90px' },
];

const EDITOR_FILES = [
  { id: 'main', label: 'main.js', process: 'Main process' },
  { id: 'preload', label: 'preload.js', process: 'Preload' },
  { id: 'renderer', label: 'renderer.js', process: 'Renderer' },
  { id: 'html', label: 'index.html', process: 'Renderer' },
  { id: 'css', label: 'styles.css', process: 'Renderer' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.grid}>{children}</div>
    </section>
  );
}

function Specimen({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={styles.specimen} data-wide={wide || undefined}>
      <div className={styles.specimenLabel}>{label}</div>
      {children}
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

function Col({ children }: { children: ReactNode }) {
  return <div className={styles.col}>{children}</div>;
}

/** Glass on a stand-in desktop, for chrome controls. */
function GlassWell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.glassWell}>
      <div className={styles.glassInner}>{children}</div>
    </div>
  );
}

/** A stand-in desktop behind overlays. */
function StageWell({ children }: { children: ReactNode }) {
  return <div className={styles.stageWell}>{children}</div>;
}

function RunCapsule({ state }: { state: 'ready' | 'downloading' | 'starting' | 'running' }) {
  return (
    <ToolbarCapsule label="Run controls">
      <Select aria-label="Electron version" items={VERSIONS} defaultValue="43.0.0" style={{ width: 180 }} />
      {state === 'ready' && (
        <Button variant="primary" icon="play" kbd="⌘R" style={{ minWidth: 108 }}>
          Run
        </Button>
      )}
      {state === 'downloading' && (
        <Button variant="primary" progress={42} style={{ minWidth: 108 }}>
          Downloading 42%
        </Button>
      )}
      {state === 'starting' && (
        <Button variant="primary" loading style={{ minWidth: 108 }}>
          Starting
        </Button>
      )}
      {state === 'running' && (
        <Button variant="stop" icon="stop" kbd="⌘R" isPressed={false} style={{ minWidth: 108 }}>
          Stop
        </Button>
      )}
    </ToolbarCapsule>
  );
}

function SplitDemo() {
  const [width, setWidth] = useState(160);
  const [height, setHeight] = useState(56);
  return (
    <div className={styles.splitDemo}>
      <div className={styles.splitRow}>
        <div className={styles.pane} style={{ width }}>
          Sidebar · {width}px
        </div>
        <SplitHandle value={width} min={100} max={260} onChange={setWidth} onReset={() => setWidth(160)} label="Resize sidebar" />
        <div className={styles.pane} style={{ flex: 1 }}>
          Editor
        </div>
      </div>
      <SplitHandle
        orientation="horizontal"
        value={height}
        min={32}
        max={120}
        onChange={setHeight}
        onReset={() => setHeight(56)}
        reverse
        label="Resize console"
      />
      <div className={styles.pane} style={{ height }}>
        Console · {height}px
      </div>
    </div>
  );
}

function LiveOverlays() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState('');
  return (
    <Col>
      <Row>
        <Button onPress={() => setOpen(true)}>Open dialog</Button>
        <Button
          variant="danger"
          icon="trash"
          onPress={async () => {
            const ok = await confirmDialog({
              title: 'Delete this fiddle?',
              message: 'It will be removed from this computer. Published gists stay online.',
              confirmLabel: 'Delete',
              cancelLabel: 'Cancel',
              tone: 'danger',
              icon: 'warning',
              iconTone: 'danger',
            });
            setResult(ok ? 'Confirmed' : 'Cancelled');
          }}
        >
          Confirm
        </Button>
        <Button
          onPress={async () => {
            const name = await promptDialog({
              title: 'Name this fiddle',
              label: 'Name',
              defaultValue: 'window-vibrancy',
              confirmLabel: 'Save',
              cancelLabel: 'Cancel',
            });
            setResult(name === null ? 'Cancelled' : `Named ${name}`);
          }}
        >
          Prompt
        </Button>
      </Row>
      <Row>
        <Button
          onPress={() => showToast({ tone: 'success', title: 'Copied', description: 'The gist link is on your clipboard.' })}
        >
          Show a toast
        </Button>
        <Button
          onPress={() =>
            showToast({ tone: 'info', title: 'Electron 44.0.0-beta.3 is ready', actionLabel: 'Switch', onAction: () => {} })
          }
        >
          Toast with an action
        </Button>
      </Row>
      {result && <div className={styles.muted}>{result}</div>}
      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        title="Publish fiddle"
        description="Creates a gist that anyone with the link can open."
        closeLabel="Close"
        footer={
          <>
            <Button variant="ghost" onPress={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon="upload" onPress={() => setOpen(false)}>
              Publish
            </Button>
          </>
        }
      >
        <TextField label="Description" defaultValue="Vibrancy on macOS" />
        <Checkbox defaultSelected>Secret gist</Checkbox>
      </Dialog>
    </Col>
  );
}

export interface GalleryProps {
  initialAppearance?: Appearance;
  initialNoMaterial?: boolean;
}

export function Gallery({ initialAppearance = 'dark', initialNoMaterial = false }: GalleryProps) {
  const [appearance, setAppearance] = useState<Appearance>(initialAppearance);
  const [noMaterial, setNoMaterial] = useState(initialNoMaterial);
  const [file, setFile] = useState('renderer');
  const [split, setSplit] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = appearance;
  }, [appearance]);
  useEffect(() => {
    document.documentElement.classList.toggle('lu-no-material', noMaterial);
  }, [noMaterial]);

  const current = EDITOR_FILES.find((f) => f.id === file) ?? EDITOR_FILES[0]!;

  return (
    <div className={styles.stage}>
      <div className={styles.window}>
        <header className={styles.titlebar}>
          <div className={styles.titleStart}>
            <ToolbarButton icon="sidebar" label="Toggle sidebar" isPressed />
            <span className={styles.windowTitle}>
              Lucent gallery <span className={styles.edited}>Edited</span>
            </span>
          </div>
          <RunCapsule state="ready" />
          <div className={styles.titleEnd}>
            <SegmentedControl
              label="Appearance"
              size="sm"
              value={appearance}
              onChange={(v) => setAppearance(v as Appearance)}
              options={[
                { value: 'dark', icon: 'moon', 'aria-label': 'Dark' },
                { value: 'light', icon: 'sun', 'aria-label': 'Light' },
              ]}
            />
            <Switch isSelected={noMaterial} onChange={setNoMaterial}>
              No material
            </Switch>
            <ToolbarButton icon="upload">Publish</ToolbarButton>
            <Tooltip label="Settings">
              <ToolbarButton icon="settings" label="Settings" />
            </Tooltip>
          </div>
        </header>

        <div className={styles.body}>
          <aside className={styles.sidebar}>
            <div className={styles.sideHead}>Main process</div>
            <Tree aria-label="Main process files" variant="sidebar" value={file} onChange={setFile}>
              <TreeRow id="main" label="main.js" />
            </Tree>
            <div className={styles.sideHead}>Preload</div>
            <Tree aria-label="Preload files" variant="sidebar" value={file} onChange={setFile}>
              <TreeRow id="preload" label="preload.js" />
            </Tree>
            <div className={styles.sideHead}>Renderer</div>
            <Tree aria-label="Renderer files" variant="sidebar" value={file} onChange={setFile}>
              <TreeRow id="html" label="index.html" />
              <TreeRow id="renderer" label="renderer.js" pill="1 error" unsaved unsavedLabel="Unsaved changes" />
              <TreeRow id="css" label="styles.css" />
            </Tree>
            <div className={styles.sideHead}>Packages</div>
            <TextField aria-label="Add a package" placeholder="Add a package" size="sm" icon="search" onGlass />
          </aside>

          <main className={styles.sheet}>
            <div className={styles.tabRow}>
              <Tabs value={file} onChange={setFile} className={styles.tabs}>
                <TabList aria-label="Open files">
                  {EDITOR_FILES.map((f) => (
                    <Tab
                      key={f.id}
                      id={f.id}
                      errorCount={f.id === 'renderer' ? 1 : undefined}
                      errorLabel="1 error"
                      unsaved={f.id === 'renderer' || f.id === 'preload'}
                      unsavedLabel="Unsaved changes"
                      icon={f.id === 'css' ? 'window' : undefined}
                    >
                      {f.label}
                    </Tab>
                  ))}
                </TabList>
              </Tabs>
              <span className={styles.process}>{current.process}</span>
              <Tooltip label={split ? 'Close split' : 'Split editor'} kbd="⌘\">
                <IconButton
                  icon="columns"
                  size="sm"
                  label={split ? 'Close split' : 'Split editor'}
                  isPressed={split}
                  onPress={() => setSplit(!split)}
                />
              </Tooltip>
            </div>

            <div className={styles.sheetBody}>
              <Section title="Actions">
                <Specimen label="Button · variants">
                  <Row>
                    <Button variant="primary" icon="play" kbd="⌘R">
                      Run
                    </Button>
                    <Button icon="terminal">Console</Button>
                    <Button variant="ghost" icon="link">
                      Share
                    </Button>
                    <Button variant="danger" icon="trash">
                      Delete
                    </Button>
                    <Button variant="stop" icon="stop" kbd="⌘R">
                      Stop
                    </Button>
                  </Row>
                </Specimen>
                <Specimen label="Button · small">
                  <Row>
                    <Button variant="primary" size="sm">
                      Install
                    </Button>
                    <Button size="sm">Cancel</Button>
                    <Button variant="ghost" size="sm" icon="plus">
                      File
                    </Button>
                    <Button variant="danger" size="sm" icon="trash">
                      Remove
                    </Button>
                  </Row>
                </Specimen>
                <Specimen label="Button · states: disabled, loading, progress, toggled, fill">
                  <Row>
                    <Button variant="primary" icon="upload" isDisabled>
                      Publish
                    </Button>
                    <Button loading>Starting</Button>
                    <Button variant="primary" progress={42} style={{ minWidth: 108 }}>
                      Downloading 42%
                    </Button>
                    <Button icon="terminal" isPressed>
                      Console
                    </Button>
                  </Row>
                  <div style={{ maxWidth: 280 }}>
                    <Button icon="download" fill>
                      Download Electron 43.0.0
                    </Button>
                  </div>
                </Specimen>
                <Specimen label="Icon button · ghost, pressed, secondary, primary, small, disabled">
                  <Row>
                    <IconButton icon="settings" label="Settings" />
                    <IconButton icon="columns" label="Split editor" isPressed />
                    <IconButton icon="copy" label="Copy" variant="secondary" />
                    <IconButton icon="play" label="Run" variant="primary" />
                    <IconButton icon="close" label="Close" size="sm" />
                    <IconButton icon="trash" label="Delete" isDisabled />
                  </Row>
                </Specimen>
                <Specimen label="Run · ready, downloading, starting, running" wide>
                  <GlassWell>
                    <RunCapsule state="ready" />
                    <RunCapsule state="downloading" />
                  </GlassWell>
                  <GlassWell>
                    <RunCapsule state="starting" />
                    <RunCapsule state="running" />
                  </GlassWell>
                </Specimen>
                <Specimen label="Toolbar capsule and toolbar buttons" wide>
                  <GlassWell>
                    <ToolbarButton icon="sidebar" label="Toggle sidebar" />
                    <ToolbarButton icon="sidebar" label="Toggle sidebar" isPressed />
                    <ToolbarButton icon="upload">Publish</ToolbarButton>
                    <ToolbarButton icon="settings" label="Settings" />
                    <ToolbarButton icon="upload" isDisabled>
                      Publish
                    </ToolbarButton>
                  </GlassWell>
                </Specimen>
              </Section>

              <Section title="Inputs">
                <Specimen label="Text field · label, icon, description, invalid, disabled">
                  <Col>
                    <TextField label="Gist URL" icon="link" placeholder="https://gist.github.com/…" style={{ width: 300 }} />
                    <TextField
                      label="Fiddle name"
                      defaultValue="window-vibrancy"
                      description="Letters, numbers and dashes."
                      style={{ width: 300 }}
                    />
                    <TextField
                      label="Fiddle name"
                      defaultValue="my fiddle!"
                      isInvalid
                      errorMessage="Use letters, numbers and dashes."
                      style={{ width: 300 }}
                    />
                    <TextField
                      label="Electron mirror"
                      defaultValue="https://github.com/electron/electron/releases"
                      isDisabled
                      mono
                      style={{ width: 300 }}
                    />
                  </Col>
                </Specimen>
                <Specimen label="Text field · small, suffix, on glass">
                  <Col>
                    <TextField aria-label="Filter output" size="sm" icon="search" placeholder="Filter output" style={{ width: 220 }} />
                    <TextField
                      label="Add module"
                      icon="search"
                      placeholder="lodash, three, zod…"
                      suffix={<Kbd keys={['⌘', 'K']} />}
                      style={{ width: 300 }}
                    />
                    <GlassWell>
                      <TextField aria-label="Add a package" placeholder="Add a package" size="sm" icon="search" onGlass style={{ width: 204 }} />
                    </GlassWell>
                  </Col>
                </Specimen>
                <Specimen label="Form field · stacked, inline, disabled">
                  <Col>
                    <FormField label="Electron flags" helper="Passed to Electron when a fiddle runs.">
                      <TextField aria-label="Electron flags" defaultValue="--enable-logging" mono style={{ width: 260 }} />
                    </FormField>
                    <FormField label="Autosave" inline helper="Saves to disk after 2 seconds without typing.">
                      <Switch defaultSelected>On</Switch>
                    </FormField>
                    <FormField label="Telemetry" isDisabled helper="Managed by your organization.">
                      <Switch>Off</Switch>
                    </FormField>
                  </Col>
                </Specimen>
                <Specimen label="Select · md, small, placeholder, invalid, disabled">
                  <Col>
                    <Select label="Electron version" items={VERSIONS} defaultValue="43.0.0" style={{ width: 240 }} />
                    <Select
                      label="Architecture"
                      size="sm"
                      items={[
                        { id: 'arm64', label: 'arm64' },
                        { id: 'x64', label: 'x64' },
                      ]}
                      defaultValue="arm64"
                      style={{ width: 140 }}
                    />
                    <Select label="Example" placeholder="Choose an example" items={[{ id: 'a', label: 'Tray icon' }]} style={{ width: 240 }} />
                    <Select
                      label="Theme"
                      items={[{ id: 'x', label: 'Solarized' }]}
                      defaultValue="x"
                      isInvalid
                      errorMessage="This theme failed to load."
                      style={{ width: 240 }}
                    />
                    <Select label="Mirror" items={[{ id: 'd', label: 'Default' }]} defaultValue="d" isDisabled style={{ width: 240 }} />
                  </Col>
                </Specimen>
                <Specimen label="Select · open menu, groups and right-aligned hints">
                  <Menu aria-label="Electron version" selectionMode="single" defaultSelectedKeys={['43.0.0']}>
                    <MenuSection title="Stable">
                      <MenuItem id="43.0.0" hint="latest">
                        Electron 43.0.0
                      </MenuItem>
                      <MenuItem id="42.4.1">Electron 42.4.1</MenuItem>
                    </MenuSection>
                    <MenuSeparator />
                    <MenuSection title="Pre-release">
                      <MenuItem id="44.0.0-beta.3" hint="beta">
                        Electron 44.0.0-beta.3
                      </MenuItem>
                    </MenuSection>
                  </Menu>
                </Specimen>
                <Specimen label="Menu · icons, key caps, sections, selected, disabled, danger">
                  <Row>
                    <Menu aria-label="Fiddle" onAction={() => {}}>
                      <MenuItem id="run" icon="play" kbd="⌘R">
                        Run
                      </MenuItem>
                      <MenuItem id="restart" icon="refresh" kbd="⇧⌘R">
                        Restart
                      </MenuItem>
                      <MenuItem id="bisect" icon="git-branch" isDisabled>
                        Bisect
                      </MenuItem>
                      <MenuSeparator />
                      <MenuSection title="Layout" selectionMode="single" defaultSelectedKeys={['split']}>
                        <MenuItem id="split">Split</MenuItem>
                        <MenuItem id="tabs">Tabs</MenuItem>
                      </MenuSection>
                      <MenuSeparator />
                      <MenuItem id="copy" icon="link">
                        Copy gist URL
                      </MenuItem>
                      <MenuItem id="delete" icon="trash" isDanger>
                        Delete fiddle
                      </MenuItem>
                    </Menu>
                    <MenuTrigger>
                      <Button iconEnd="chevron-down">More</Button>
                      <MenuPopover>
                        <Menu aria-label="More" onAction={() => {}}>
                          <MenuItem id="dup" icon="copy">
                            Duplicate
                          </MenuItem>
                          <MenuItem id="win" icon="popout">
                            Open in a new window
                          </MenuItem>
                        </Menu>
                      </MenuPopover>
                    </MenuTrigger>
                  </Row>
                </Specimen>
                <Specimen label="Checkbox · on, off, mixed, disabled, invalid">
                  <Col>
                    <Checkbox defaultSelected>Show welcome screen</Checkbox>
                    <Checkbox>Hide Electron logs</Checkbox>
                    <Checkbox isIndeterminate>All modules</Checkbox>
                    <Checkbox isDisabled>Signed builds only</Checkbox>
                    <Checkbox isDisabled defaultSelected>
                      Managed by your organization
                    </Checkbox>
                    <Checkbox isInvalid>Accept the license</Checkbox>
                  </Col>
                </Specimen>
                <Specimen label="Radio group · stacked, inline with a disabled option">
                  <Col>
                    <RadioGroup label="Theme" defaultValue="system">
                      <Radio value="system">Match the system</Radio>
                      <Radio value="dark">Dark</Radio>
                      <Radio value="light">Light</Radio>
                    </RadioGroup>
                    <RadioGroup label="Architecture" orientation="horizontal" defaultValue="arm64">
                      <Radio value="arm64">arm64</Radio>
                      <Radio value="x64">x64</Radio>
                      <Radio value="ia32" isDisabled>
                        ia32
                      </Radio>
                    </RadioGroup>
                  </Col>
                </Specimen>
                <Specimen label="Switch · on, off, disabled">
                  <Col>
                    <Switch defaultSelected>Run on save</Switch>
                    <Switch>Use nightly builds</Switch>
                    <Switch isDisabled>Telemetry</Switch>
                    <Switch isDisabled defaultSelected>
                      Managed updates
                    </Switch>
                  </Col>
                </Specimen>
                <Specimen label="Segmented control · two, three, small, icons, disabled">
                  <Col>
                    <SegmentedControl
                      label="Layout"
                      options={[
                        { value: 'split', label: 'Split' },
                        { value: 'tabs', label: 'Tabs' },
                      ]}
                    />
                    <SegmentedControl
                      label="Process"
                      defaultValue="both"
                      options={[
                        { value: 'main', label: 'Main' },
                        { value: 'renderer', label: 'Renderer' },
                        { value: 'both', label: 'Both' },
                      ]}
                    />
                    <SegmentedControl
                      label="Console filter"
                      size="sm"
                      options={[
                        { value: 'all', label: 'All' },
                        { value: 'main', label: 'Main' },
                        { value: 'renderer', label: 'Renderer' },
                      ]}
                    />
                    <SegmentedControl
                      label="Theme"
                      options={[
                        { value: 'dark', icon: 'moon', 'aria-label': 'Dark' },
                        { value: 'light', icon: 'sun', 'aria-label': 'Light' },
                      ]}
                    />
                    <SegmentedControl
                      label="Disabled"
                      isDisabled
                      options={[
                        { value: 'a', label: 'On' },
                        { value: 'b', label: 'Off' },
                      ]}
                    />
                  </Col>
                </Specimen>
              </Section>

              <Section title="Navigation and structure">
                <Specimen label="Tabs · selected, error count, unsaved, pop-out glyph (see the tab row above)">
                  <Tabs defaultValue="b">
                    <TabList aria-label="Example tabs">
                      <Tab id="a">General</Tab>
                      <Tab id="b" errorCount={3} errorLabel="3 errors">
                        Problems
                      </Tab>
                      <Tab id="c" unsaved unsavedLabel="Unsaved changes">
                        Draft
                      </Tab>
                      <Tab id="d" isDisabled>
                        Disabled
                      </Tab>
                    </TabList>
                    <TabPanel id="a">
                      <span className={styles.muted}>General panel</span>
                    </TabPanel>
                    <TabPanel id="b">
                      <span className={styles.muted}>Problems panel</span>
                    </TabPanel>
                    <TabPanel id="c">
                      <span className={styles.muted}>Draft panel</span>
                    </TabPanel>
                    <TabPanel id="d">
                      <span className={styles.muted}>Disabled panel</span>
                    </TabPanel>
                  </Tabs>
                </Specimen>
                <Specimen label="Tree · on the sheet, nested, pill, unsaved">
                  <div style={{ width: 240 }}>
                    <Tree aria-label="Fiddle files" defaultValue="renderer-2" defaultExpandedKeys={['root']}>
                      <TreeRow id="root" label="my-first-fiddle" icon="folder">
                        <TreeRow id="main-2" label="main.js" />
                        <TreeRow id="preload-2" label="preload.js" unsaved unsavedLabel="Unsaved changes" />
                        <TreeRow id="renderer-2" label="renderer.js" pill="1 error" />
                        <TreeRow id="html-2" label="index.html" />
                      </TreeRow>
                      <TreeRow id="modules" label="node_modules" icon="folder">
                        <TreeRow id="lodash" label="lodash" icon="package" />
                      </TreeRow>
                      <TreeRow id="locked" label="package-lock.json" icon="lock" isDisabled />
                    </Tree>
                  </div>
                </Specimen>
                <Specimen label="Split handle · drag, arrow keys, Home and End, double-click to reset">
                  <SplitDemo />
                </Specimen>
                <Specimen label="Page and side nav" wide>
                  <div className={styles.pageBox}>
                    <Page
                      title="Settings"
                      onClose={() => {}}
                      closeLabel="Close settings"
                      closeHint="esc"
                      nav={
                        <SideNav
                          aria-label="Settings"
                          defaultValue="exec"
                          items={[
                            { id: 'general', label: 'General', icon: 'settings' },
                            { id: 'appearance', label: 'Appearance', icon: 'palette' },
                            { id: 'exec', label: 'Execution', icon: 'play' },
                            { id: 'versions', label: 'Electron versions', icon: 'download', badge: '3' },
                            { heading: 'Account' },
                            { id: 'accounts', label: 'GitHub', icon: 'user' },
                            { id: 'keys', label: 'Keyboard', icon: 'keyboard' },
                          ]}
                        />
                      }
                    >
                      <h2 className={styles.pageTitle}>Execution</h2>
                      <FormField label="Electron flags" helper="Passed to Electron when a fiddle runs.">
                        <TextField aria-label="Electron flags" defaultValue="--js-flags=--expose-gc" mono style={{ width: 320 }} />
                      </FormField>
                      <RadioGroup label="Clear the console" orientation="horizontal" defaultValue="run">
                        <Radio value="run">On every run</Radio>
                        <Radio value="never">Never</Radio>
                      </RadioGroup>
                    </Page>
                  </div>
                </Specimen>
              </Section>

              <Section title="Labels">
                <Specimen label="Badge · tones, dot">
                  <Row>
                    <Badge tone="success">Stable</Badge>
                    <Badge tone="accent">Beta</Badge>
                    <Badge tone="warning">Nightly</Badge>
                    <Badge tone="danger" dot>
                      Running
                    </Badge>
                    <Badge>arm64</Badge>
                  </Row>
                </Specimen>
                <Specimen label="Tag · tones, removable">
                  <Row>
                    <Tag>arm64</Tag>
                    <Tag tone="accent">beta</Tag>
                    <Tag tone="success">stable</Tag>
                    <Tag tone="warning">draft</Tag>
                    <Tag tone="danger">unsupported</Tag>
                    <Tag tone="accent" onRemove={() => {}} removeLabel="Remove electron-store">
                      electron-store
                    </Tag>
                  </Row>
                </Specimen>
                <Specimen label="Kbd">
                  <Col>
                    <div className={styles.kbdLine}>
                      <span>Run</span>
                      <Kbd keys={['⌘', 'R']} />
                    </div>
                    <div className={styles.kbdLine}>
                      <span>Command palette</span>
                      <Kbd keys={['⌘', '⇧', 'P']} />
                    </div>
                    <div className={styles.kbdLine}>
                      <span>Close</span>
                      <Kbd>esc</Kbd>
                    </div>
                  </Col>
                </Specimen>
                <Specimen label="Inline code and status pill">
                  <p className={styles.prose}>
                    Expose APIs with <InlineCode>contextBridge.exposeInMainWorld</InlineCode> from{' '}
                    <InlineCode>preload.js</InlineCode>.
                  </p>
                  <Row>
                    <StatusPill>Running</StatusPill>
                  </Row>
                </Specimen>
              </Section>

              <Section title="Feedback and overlays">
                <Specimen label="Tooltip · with shortcut, on a disabled control">
                  <div className={styles.tooltipRow}>
                    <Tooltip label="Split editor" kbd="⌘\" isOpen>
                      <IconButton icon="columns" label="Split editor" />
                    </Tooltip>
                    <Tooltip label="Sign in to GitHub to publish" isOpen triggerDisabled>
                      <Button icon="upload" isDisabled>
                        Publish
                      </Button>
                    </Tooltip>
                  </div>
                </Specimen>
                <Specimen label="Progress bar · determinate, indeterminate, done">
                  <Col>
                    <div className={styles.fullWidth}>
                      <ProgressBar label="Downloading 44.0.0-beta.3" detail="62 / 104 MB" value={60} />
                    </div>
                    <div className={styles.fullWidth}>
                      <ProgressBar label="Installing modules" />
                    </div>
                    <div className={styles.fullWidth}>
                      <ProgressBar label="Unzipped" detail="done" value={100} />
                    </div>
                  </Col>
                </Specimen>
                <Specimen label="Progress ring and spinner · 14 and 24">
                  <div className={styles.rings}>
                    <ProgressRing value={35} label="Downloading" />
                    <ProgressRing value={72} size={24} label="Downloading" />
                    <Spinner label="Loading" />
                    <Spinner size={24} label="Loading" />
                  </div>
                </Specimen>
                <Specimen label="Callout · default, primary, danger">
                  <Col>
                    <Callout title="Sandboxed by default">
                      Renderers have no Node.js access. Use preload.js to expose what they need.
                    </Callout>
                    <Callout
                      intent="primary"
                      title="New in Electron 43"
                      action={
                        <Button size="sm" variant="ghost" iconEnd="arrow-right">
                          See what changed
                        </Button>
                      }
                    >
                      The Tray API supports template images on Windows.
                    </Callout>
                    <Callout intent="danger" title="Electron 40 is no longer supported">
                      It stops receiving security fixes. Pick a newer version to keep testing.
                    </Callout>
                  </Col>
                </Specimen>
                <Specimen label="Toast · success, error, info, warning" wide>
                  <StageWell>
                    <div className={styles.toastStack}>
                      <Toast tone="success" title="Published" actionLabel="Copy link" closeLabel="Dismiss" onClose={() => {}}>
                        gist.github.com/8f3a2c
                      </Toast>
                      <Toast tone="error" title="Fiddle crashed" actionLabel="Logs">
                        Renderer exited with code 1.
                      </Toast>
                    </div>
                    <div className={styles.toastStack}>
                      <Toast tone="info" title="Electron 44.0.0-beta.3 is ready" actionLabel="Switch" />
                      <Toast tone="warning" title="Package not found" closeLabel="Dismiss" onClose={() => {}}>
                        lodahs is not on npm.
                      </Toast>
                    </div>
                  </StageWell>
                </Specimen>
                <Specimen label="Dialog · form, alert" wide>
                  <StageWell>
                    <DialogSurface
                      title="Publish fiddle"
                      description="Creates a gist that anyone with the link can open."
                      closeLabel="Close"
                      onClose={() => {}}
                      footer={
                        <>
                          <Button variant="ghost">Cancel</Button>
                          <Button variant="primary" icon="upload">
                            Publish
                          </Button>
                        </>
                      }
                    >
                      <TextField label="Description" defaultValue="Vibrancy on macOS" />
                      <Checkbox defaultSelected>Secret gist</Checkbox>
                    </DialogSurface>
                    <DialogSurface
                      title="Discard unsaved changes?"
                      icon="warning"
                      iconTone="warning"
                      width={400}
                      description="renderer.js and styles.css have changes that are not saved."
                      footer={
                        <>
                          <Button variant="ghost">Keep editing</Button>
                          <Button variant="danger">Discard</Button>
                        </>
                      }
                    />
                  </StageWell>
                </Specimen>
                <Specimen label="Popover · anchored with an arrow">
                  <div className={styles.popoverRoom}>
                    <PopoverTrigger defaultOpen>
                      <Button icon="info">Version info</Button>
                      <Popover isNonModal width={240} aria-label="Version info">
                        <div className={styles.popoverBody}>
                          <strong>Electron 43.0.0</strong>
                          <span className={styles.muted}>Chromium, Node and V8 versions ship with each release.</span>
                        </div>
                      </Popover>
                    </PopoverTrigger>
                  </div>
                </Specimen>
                <Specimen label="Live: dialog, confirm and prompt helpers, toasts">
                  <LiveOverlays />
                </Specimen>
                <Specimen label="Empty state">
                  <div className={styles.emptyBox}>
                    <EmptyState
                      title="No editors open"
                      action={
                        <Button icon="plus" variant="secondary">
                          New file
                        </Button>
                      }
                    >
                      Pick a file in the sidebar, or start from one of the examples.
                    </EmptyState>
                  </div>
                </Specimen>
              </Section>

              <Section title="Content">
                <Specimen label="Card · clickable with icon, avatar, static" wide>
                  <div className={styles.cards}>
                    <Card icon="window" title="Hello World" description="A window with a preload script" onPress={() => {}} />
                    <Card icon="bell" title="Notifications" description="Native notifications from the renderer" onPress={() => {}} />
                    <Card avatar="Felix Rieseberg" title="Felix Rieseberg" description="Signed in to GitHub" onPress={() => {}} />
                    <Card icon="book" title="Tray" description="From the Electron docs" />
                  </div>
                </Specimen>
                <Specimen label="List row · selected, meta, tags, disabled">
                  <List aria-label="Fiddles" defaultValue="vib">
                    <ListRow id="vib" icon="window" title="window-vibrancy" meta="gist 8f3a2c · edited 2 min ago" tags={<Tag>secret</Tag>} />
                    <ListRow id="tray" icon="window" title="tray-menu" meta="gist 1b7e40 · edited yesterday" tags={<Tag tone="accent">public</Tag>} />
                    <ListRow id="untitled" icon="file" title="untitled-3" meta="not saved" tags={<Tag tone="warning">draft</Tag>} />
                    <ListRow id="old" icon="file" title="archived-demo" meta="read only" isDisabled />
                  </List>
                </Specimen>
                <Specimen label="Table · sections, mono, right-aligned, selected row, empty" wide>
                  <Table aria-label="Electron versions" columns={TABLE_COLUMNS} rows={TABLE_ROWS} selectedIds={['42.4.1']} />
                  <Table
                    aria-label="Filtered versions"
                    columns={TABLE_COLUMNS}
                    rows={[]}
                    emptyMessage="No versions match these filters"
                  />
                </Specimen>
              </Section>

              <Section title="Icons">
                <div className={styles.iconGrid} data-wide>
                  {iconNames.map((name) => (
                    <div key={name} className={styles.iconCell}>
                      <Icon name={name} />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Type">
                <div className={styles.typeList} data-wide>
                  <div className={styles.typeDisplay}>Build it in a fiddle</div>
                  <div className={styles.typeTitle}>Electron versions</div>
                  <div className={styles.typeHeadline}>Installed versions</div>
                  <div className={styles.typeBody}>Choose which Electron version runs your fiddle.</div>
                  <div className={styles.typeLabel}>Run fiddle</div>
                  <div className={styles.typeCaption}>Renderer process</div>
                  <div className={styles.typeCode}>win.loadFile('index.html')</div>
                </div>
              </Section>
            </div>
          </main>
        </div>

        <footer className={styles.status}>
          <StatusPill>Running</StatusPill>
          <span>Electron 43.0.0</span>
          <span>arm64</span>
          <span className={styles.spacer} />
          <span>Ln 4, Col 5</span>
          <span>JavaScript</span>
        </footer>
      </div>
      <Toaster closeLabel="Dismiss" aria-label="Notifications" />
      <DialogHost />
    </div>
  );
}
