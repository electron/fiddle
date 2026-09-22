/* The Lucent gallery: every component in every state that can be shown at rest.
   Hover, press and focus are live. Dev tool only: the sample text is specimen copy,
   not app strings. */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Button,
  Callout,
  Checkbox,
  confirmDialog,
  Dialog,
  DialogHost,
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
  Toaster,
  ToolbarButton,
  ToolbarCapsule,
  Tree,
  TreeRow,
  type SelectOption,
  type TableColumn,
  type TableSection,
} from '../index';
import styles from './Gallery.module.css';

type Appearance = 'dark' | 'light';

const noop = () => {};

const VERSIONS: SelectOption[] = [
  { id: '43.0.0', label: 'Electron 43.0.0', hint: 'latest' },
  { id: '42.4.1', label: 'Electron 42.4.1' },
  { id: '44.0.0-beta.3', label: 'Electron 44.0.0-beta.3', hint: 'beta' },
  { id: '45.0.0-nightly', label: 'Electron 45.0.0-nightly', hint: 'nightly' },
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
        <Tag tone="success">Downloaded</Tag>
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

function Specimen({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
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

function RunCapsule({
  state,
}: {
  state: 'ready' | 'downloading' | 'starting' | 'running';
}) {
  return (
    <ToolbarCapsule label="Run controls">
      <Select
        aria-label="Electron version"
        items={VERSIONS}
        value="43.0.0"
        style={{ width: 180 }}
      />
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
        <Button
          variant="stop"
          icon="stop"
          kbd="⌘R"
          isPressed={false}
          style={{ minWidth: 108 }}
        >
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
        <SplitHandle
          value={width}
          min={100}
          max={260}
          onChange={setWidth}
          onReset={() => setWidth(160)}
          label="Resize sidebar"
        />
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
              message:
                'It will be removed from this computer. Published gists stay online.',
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
          onPress={() =>
            showToast({
              tone: 'success',
              title: 'Published',
              description: 'gist.github.com/8f3a2c',
            })
          }
        >
          Success toast
        </Button>
        <Button
          onPress={() =>
            showToast({
              tone: 'error',
              title: 'Fiddle crashed',
              description: 'Renderer exited with code 1.',
            })
          }
        >
          Error toast
        </Button>
        <Button
          onPress={() =>
            showToast({
              tone: 'warning',
              title: 'Package not found',
              description: 'lodahs is not on npm.',
            })
          }
        >
          Warning toast
        </Button>
        <Button
          onPress={() =>
            showToast({
              tone: 'info',
              title: 'Electron 44.0.0-beta.3 is ready',
              actionLabel: 'Switch',
              onAction: () => {},
            })
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

export function Gallery({
  initialAppearance = 'dark',
  initialNoMaterial = false,
}: GalleryProps) {
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
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
            />
            <Switch isSelected={noMaterial} onChange={setNoMaterial}>
              No material
            </Switch>
            <ToolbarButton icon="upload" label="Publish">
              Publish
            </ToolbarButton>
            <ToolbarButton icon="settings" label="Settings" tooltip />
          </div>
        </header>

        <div className={styles.body}>
          <aside className={styles.sidebar}>
            <div className={styles.sideHead}>Main process</div>
            <Tree aria-label="Main process files" value={file} onChange={setFile}>
              <TreeRow id="main" label="main.js" />
            </Tree>
            <div className={styles.sideHead}>Preload</div>
            <Tree aria-label="Preload files" value={file} onChange={setFile}>
              <TreeRow id="preload" label="preload.js" />
            </Tree>
            <div className={styles.sideHead}>Renderer</div>
            <Tree aria-label="Renderer files" value={file} onChange={setFile}>
              <TreeRow id="html" label="index.html" />
              <TreeRow
                id="renderer"
                label="renderer.js"
                pill="1 error"
                unsaved="Unsaved changes"
              />
              <TreeRow id="css" label="styles.css" />
            </Tree>
            <div className={styles.sideHead}>Packages</div>
            <TextField
              aria-label="Add a package"
              placeholder="Add a package"
              size="sm"
              icon="search"
              onGlass
            />
          </aside>

          <main className={styles.sheet}>
            <div className={styles.tabRow}>
              <Tabs value={file} onChange={setFile} className={styles.tabs}>
                <TabList aria-label="Open files">
                  {EDITOR_FILES.map((f) => (
                    <Tab
                      key={f.id}
                      id={f.id}
                      error={
                        f.id === 'renderer' ? { count: 1, label: '1 error' } : undefined
                      }
                      unsaved={
                        f.id === 'renderer' || f.id === 'preload'
                          ? 'Unsaved changes'
                          : undefined
                      }
                      icon={f.id === 'css' ? 'file' : undefined}
                    >
                      {f.label}
                    </Tab>
                  ))}
                </TabList>
              </Tabs>
              <span className={styles.process}>{current.process}</span>
              <IconButton
                icon="columns"
                size="sm"
                label={split ? 'Close split' : 'Split editor'}
                tooltip={{ kbd: '⌘\\' }}
                isPressed={split}
                onPress={() => setSplit(!split)}
              />
            </div>

            <div className={styles.sheetBody}>
              <Section title="Actions">
                <Specimen label="Button · variants">
                  <Row>
                    <Button variant="primary" icon="play" kbd="⌘R">
                      Run
                    </Button>
                    <Button icon="code">Console</Button>
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
                <Specimen label="Button · states: disabled, loading, progress, toggled">
                  <Row>
                    <Button variant="primary" icon="upload" isDisabled>
                      Publish
                    </Button>
                    <Button loading>Starting</Button>
                    <Button variant="primary" progress={42} style={{ minWidth: 108 }}>
                      Downloading 42%
                    </Button>
                    <Button icon="code" isPressed>
                      Console
                    </Button>
                  </Row>
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
                    <ToolbarButton icon="upload" label="Publish">
                      Publish
                    </ToolbarButton>
                    <ToolbarButton icon="settings" label="Settings" />
                    <ToolbarButton icon="upload" label="Publish" isDisabled>
                      Publish
                    </ToolbarButton>
                  </GlassWell>
                </Specimen>
              </Section>

              <Section title="Inputs">
                <Specimen label="Text field · label, icon, description, invalid, disabled">
                  <Col>
                    <TextField
                      label="Gist URL"
                      icon="link"
                      placeholder="https://gist.github.com/…"
                      style={{ width: 300 }}
                    />
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
                <Specimen label="Text field · small, on glass">
                  <Col>
                    <TextField
                      aria-label="Filter output"
                      size="sm"
                      icon="search"
                      placeholder="Filter output"
                      style={{ width: 220 }}
                    />
                    <GlassWell>
                      <TextField
                        aria-label="Add a package"
                        placeholder="Add a package"
                        size="sm"
                        icon="search"
                        onGlass
                        style={{ width: 204 }}
                      />
                    </GlassWell>
                  </Col>
                </Specimen>
                <Specimen label="Form field">
                  <FormField label="Autosave">
                    <Switch defaultSelected>On</Switch>
                  </FormField>
                </Specimen>
                <Specimen label="Select · hints, placeholder, invalid, disabled">
                  <Col>
                    <Select
                      label="Electron version"
                      items={VERSIONS}
                      value="43.0.0"
                      style={{ width: 240 }}
                    />
                    <Select
                      label="Example"
                      placeholder="Choose an example"
                      items={[{ id: 'a', label: 'Tray icon' }]}
                      style={{ width: 240 }}
                    />
                    <Select
                      label="Theme"
                      items={[{ id: 'x', label: 'Solarized' }]}
                      value="x"
                      isInvalid
                      errorMessage="This theme failed to load."
                      style={{ width: 240 }}
                    />
                    <Select
                      label="Mirror"
                      items={[{ id: 'd', label: 'Default' }]}
                      value="d"
                      isDisabled
                      style={{ width: 240 }}
                    />
                  </Col>
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
                      <MenuSection
                        title="Layout"
                        selectionMode="single"
                        defaultSelectedKeys={['split']}
                      >
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
                      <Button>More</Button>
                      <MenuPopover>
                        <Menu aria-label="More" onAction={() => {}}>
                          <MenuItem id="dup" icon="copy">
                            Duplicate
                          </MenuItem>
                          <MenuItem id="win" icon="external">
                            Open in a new window
                          </MenuItem>
                        </Menu>
                      </MenuPopover>
                    </MenuTrigger>
                  </Row>
                </Specimen>
                <Specimen label="Checkbox · on, off, disabled, invalid">
                  <Col>
                    <Checkbox defaultSelected>Show welcome screen</Checkbox>
                    <Checkbox>Hide Electron logs</Checkbox>
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
                    <RadioGroup
                      label="Architecture"
                      orientation="horizontal"
                      defaultValue="arm64"
                    >
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
                <Specimen label="Segmented control · two, three, small, disabled">
                  <Col>
                    <SegmentedControl
                      label="Layout"
                      value="split"
                      onChange={noop}
                      options={[
                        { value: 'split', label: 'Split' },
                        { value: 'tabs', label: 'Tabs' },
                      ]}
                    />
                    <SegmentedControl
                      label="Process"
                      value="both"
                      onChange={noop}
                      options={[
                        { value: 'main', label: 'Main' },
                        { value: 'renderer', label: 'Renderer' },
                        { value: 'both', label: 'Both' },
                      ]}
                    />
                    <SegmentedControl
                      label="Console filter"
                      size="sm"
                      value="all"
                      onChange={noop}
                      options={[
                        { value: 'all', label: 'All' },
                        { value: 'main', label: 'Main' },
                        { value: 'renderer', label: 'Renderer' },
                      ]}
                    />
                    <SegmentedControl
                      label="Disabled"
                      isDisabled
                      value="a"
                      onChange={noop}
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
                      <Tab id="b" error={{ count: 3, label: '3 errors' }}>
                        Problems
                      </Tab>
                      <Tab id="c" unsaved="Unsaved changes">
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
                          value="exec"
                          onChange={noop}
                          items={[
                            { id: 'general', label: 'General', icon: 'settings' },
                            { id: 'appearance', label: 'Appearance', icon: 'eye' },
                            { id: 'exec', label: 'Execution', icon: 'play' },
                            {
                              id: 'versions',
                              label: 'Electron versions',
                              icon: 'download',
                            },
                            { id: 'accounts', label: 'GitHub', icon: 'user' },
                            { id: 'keys', label: 'Keyboard', icon: 'keyboard' },
                          ]}
                        />
                      }
                    >
                      <h2 className={styles.pageTitle}>Execution</h2>
                      <FormField label="Electron flags">
                        <TextField
                          aria-label="Electron flags"
                          defaultValue="--js-flags=--expose-gc"
                          mono
                          style={{ width: 320 }}
                        />
                      </FormField>
                      <RadioGroup
                        label="Clear the console"
                        orientation="horizontal"
                        defaultValue="run"
                      >
                        <Radio value="run">On every run</Radio>
                        <Radio value="never">Never</Radio>
                      </RadioGroup>
                    </Page>
                  </div>
                </Specimen>
              </Section>

              <Section title="Labels">
                <Specimen label="Tag · tones">
                  <Row>
                    <Tag>arm64</Tag>
                    <Tag tone="accent">beta</Tag>
                    <Tag tone="success">stable</Tag>
                    <Tag tone="warning">draft</Tag>
                    <Tag tone="danger">unsupported</Tag>
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
                    Expose APIs with{' '}
                    <InlineCode>contextBridge.exposeInMainWorld</InlineCode> from{' '}
                    <InlineCode>preload.js</InlineCode>.
                  </p>
                  <Row>
                    <StatusPill>Running</StatusPill>
                  </Row>
                </Specimen>
              </Section>

              <Section title="Feedback and overlays">
                <Specimen label="Progress ring and spinner">
                  <div className={styles.rings}>
                    <ProgressRing value={35} />
                    <ProgressRing value={72} />
                    <Spinner />
                  </div>
                </Specimen>
                <Specimen label="Callout">
                  <Callout>
                    Renderers have no Node.js access. Use preload.js to expose what they
                    need.
                  </Callout>
                </Specimen>
                <Specimen label="Popover · anchored with an arrow">
                  <div className={styles.popoverRoom}>
                    <PopoverTrigger defaultOpen>
                      <Button icon="info">Version info</Button>
                      <Popover isNonModal width={240} aria-label="Version info">
                        <div className={styles.popoverBody}>
                          <strong>Electron 43.0.0</strong>
                          <span className={styles.muted}>
                            Chromium, Node and V8 versions ship with each release.
                          </span>
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
                <Specimen label="List row · selected, meta, tags">
                  <List aria-label="Fiddles" value="vib" onChange={noop}>
                    <ListRow
                      id="vib"
                      icon="file"
                      title="window-vibrancy"
                      meta="gist 8f3a2c · edited 2 min ago"
                      tags={<Tag>secret</Tag>}
                    />
                    <ListRow
                      id="tray"
                      icon="file"
                      title="tray-menu"
                      meta="gist 1b7e40 · edited yesterday"
                      tags={<Tag tone="accent">public</Tag>}
                    />
                    <ListRow
                      id="untitled"
                      icon="file"
                      title="untitled-3"
                      meta="not saved"
                      tags={<Tag tone="warning">draft</Tag>}
                    />
                  </List>
                </Specimen>
                <Specimen label="Table · sections, mono, right-aligned, empty" wide>
                  <Table
                    aria-label="Electron versions"
                    columns={TABLE_COLUMNS}
                    rows={TABLE_ROWS}
                  />
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
                  <div className={styles.typeBody}>
                    Choose which Electron version runs your fiddle.
                  </div>
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
