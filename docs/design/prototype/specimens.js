

var F = window.Fiddle, h = React.createElement;
function R() { return h.apply(null, ['div', { className: 'fdx-r' }].concat([].slice.call(arguments))); }
function C() { return h.apply(null, ['div', { className: 'fdx-c' }].concat([].slice.call(arguments))); }
function S() { return h.apply(null, ['div', { className: 'fdx-s' }].concat([].slice.call(arguments))); }
var CARDS = [
{ name: "Button", group: "Actions", sub: "primary \u00b7 secondary \u00b7 ghost \u00b7 danger", summary: "Commands, from Run to Cancel.", style: undefined, css: "", render: function () { return S(
  R(h(F.Button, { variant: 'primary', icon: 'play', kbd: '\u2318R' }, 'Run'), h(F.Button, { icon: 'terminal' }, 'Console')),
  R(h(F.Button, { variant: 'ghost', icon: 'link' }, 'Share'), h(F.Button, { variant: 'danger', icon: 'stop' }, 'Stop')),
  R(h(F.Button, { variant: 'primary', size: 'sm' }, 'Install'), h(F.Button, { size: 'sm' }, 'Cancel'), h(F.Button, { size: 'sm', variant: 'ghost', icon: 'plus' }, 'File')),
  R(h(F.Button, { variant: 'primary', disabled: true, icon: 'upload' }, 'Publish'), h(F.Button, { loading: true }, 'Downloading'), h(F.Button, { active: true, icon: 'terminal' }, 'Console')),
  h('div', { style: { maxWidth: 260 } }, h(F.Button, { fill: true, variant: 'secondary', icon: 'download' }, 'Download Electron 43.0.0'))); } },
{ name: "IconButton", group: "Actions", sub: "toolbar and inline actions", summary: "A square button with only an icon, for toolbars and inline row actions.", style: undefined, css: "", render: function () { return R(h(F.IconButton, { icon: 'gear', label: 'Settings' }), h(F.IconButton, { icon: 'plus', label: 'New file' }),
  h(F.IconButton, { icon: 'terminal', label: 'Console', pressed: true }), h(F.IconButton, { icon: 'copy', label: 'Copy', variant: 'secondary' }),
  h(F.IconButton, { icon: 'play', label: 'Run', variant: 'primary' }), h(F.IconButton, { icon: 'x', label: 'Close', size: 'sm' })); } },
{ name: "Input", group: "Inputs", sub: "text fields with label, icon, hint, error", summary: "Single-line text fields: the gist URL, module search, fiddle name.", style: undefined, css: "", render: function () { return S(
  h(F.Input, { label: 'Gist URL', icon: 'link', placeholder: 'https://gist.github.com/\u2026' }),
  h(F.Input, { label: 'Add module', icon: 'search', placeholder: 'lodash, three, zod\u2026', suffix: h(F.Kbd, null, '\u2318K') }),
  h(F.Input, { label: 'Fiddle name', defaultValue: 'my fiddle!', error: 'Use letters, numbers and dashes.' }),
  h(F.Input, { label: 'Electron mirror', defaultValue: 'https://github.com/electron/electron/releases', disabled: true, mono: true })); } },
{ name: "Select", group: "Inputs", sub: "dropdown, shown open", summary: "A dropdown for choosing one value; the Electron version picker is the reference case.", style: { minHeight: 430 }, css: "", render: function () { var opts = [{ heading: 'Stable' }, { value: '43.0.0', label: '43.0.0', hint: 'latest' }, { value: '42.4.1', label: '42.4.1' }, { value: '41.6.2', label: '41.6.2' },
  { separator: true }, { heading: 'Pre-release' }, { value: '44b', label: '44.0.0-beta.3', hint: 'beta' }, { value: '45n', label: '45.0.0-nightly', hint: 'nightly' }];
return S(
  h(F.Select, { label: 'Architecture', size: 'sm', defaultValue: 'arm64', options: [{ value: 'arm64', label: 'arm64' }, { value: 'x64', label: 'x64' }] }),
  h(F.Select, { label: 'Electron version', defaultValue: '43.0.0', defaultOpen: true, options: opts })); } },
{ name: "Menu", group: "Navigation", sub: "context and app menus", summary: "A list of commands in a popover surface.", style: undefined, css: "", render: function () { return h(F.Menu, { items: [
  { label: 'Run', icon: 'play', kbd: '\u2318R' }, { label: 'Restart', icon: 'refresh', kbd: '\u21e7\u2318R' }, { separator: true },
  { heading: 'Layout' }, { label: 'Split', checked: true }, { label: 'Tabs', checked: false }, { separator: true },
  { label: 'Copy gist URL', icon: 'link' }, { label: 'Delete fiddle', icon: 'trash', danger: true }] }); } },
{ name: "Checkbox", group: "Inputs", sub: "on \u00b7 off \u00b7 mixed \u00b7 disabled", summary: "A setting saved when a form is confirmed, or one of several independent choices.", style: undefined, css: "", render: function () { return C(h(F.Checkbox, { label: 'Show welcome screen', defaultChecked: true }), h(F.Checkbox, { label: 'Hide Electron logs' }),
  h(F.Checkbox, { label: 'All modules', indeterminate: true }), h(F.Checkbox, { label: 'Signed builds only', disabled: true })); } },
{ name: "Switch", group: "Inputs", sub: "immediate settings", summary: "An on/off setting that takes effect immediately, such as Run on save.", style: undefined, css: "", render: function () { return C(h(F.Switch, { label: 'Run on save', defaultChecked: true }), h(F.Switch, { label: 'Use nightly builds' }), h(F.Switch, { label: 'Telemetry', disabled: true })); } },
{ name: "SegmentedControl", group: "Inputs", sub: "2 to 4 exclusive options", summary: "Two to four mutually exclusive options that switch a view, such as Split and Tabs layouts.", style: undefined, css: "", render: function () { return C(h(F.SegmentedControl, { label: 'Layout', options: [{ value: 's', label: 'Split' }, { value: 't', label: 'Tabs' }] }),
  h(F.SegmentedControl, { label: 'Process', defaultValue: 'b', options: [{ value: 'm', label: 'Main' }, { value: 'r', label: 'Renderer' }, { value: 'b', label: 'Both' }] })); } },
{ name: "Tabs", group: "Navigation", sub: "editor tabs with unsaved dot", summary: "Editor tabs, one per open file.", style: { paddingLeft: 0, paddingRight: 0, maxWidth: "none" }, css: "", render: function () { return h(F.Tabs, { defaultValue: 'main', onClose: function () {}, tabs: [{ id: 'main', label: 'main.js' }, { id: 'pre', label: 'preload.js', dirty: true }, { id: 'html', label: 'index.html' }] }); } },
{ name: "FileTree", group: "Navigation", sub: "visibility toggles, inline new file, context menu", summary: "The editors sidebar: files and folders in a fiddle.", style: { paddingLeft: 8, paddingRight: 8, maxWidth: 300 }, css: "", render: function () { return h(F.FileTree, { defaultValue: 'main', visibility: true, creating: 'tray.js', contextItems: [{ label: 'Rename', kbd: 'F2' }, { label: 'Hide editor', icon: 'eye-off' }, { separator: true }, { label: 'Delete', icon: 'trash', danger: true }], items: [
  { id: 'root', name: 'my-first-fiddle', kind: 'folder', open: true, depth: 0 },
  { id: 'main', name: 'main.js', depth: 1 }, { id: 'pre', name: 'preload.js', depth: 1, dirty: true }, { id: 'ren', name: 'renderer.js', depth: 1, hidden: true },
  { id: 'html', name: 'index.html', depth: 1 }, { id: 'css', name: 'styles.css', depth: 1 },
  { id: 'nm', name: 'node_modules', kind: 'folder', depth: 1, badge: '3' }] }); } },
{ name: "Badge", group: "Feedback", sub: "release channels and state", summary: "One or two words of status: release channel, architecture, running.", style: undefined, css: "", render: function () { return R(h(F.Badge, { tone: 'success' }, 'Stable'), h(F.Badge, { tone: 'accent' }, 'Beta'), h(F.Badge, { tone: 'warning' }, 'Nightly'),
  h(F.Badge, { tone: 'spark', dot: true }, 'Running'), h(F.Badge, null, 'arm64')); } },
{ name: "Tooltip", group: "Feedback", sub: "label plus shortcut; works on disabled buttons", summary: "The name and shortcut of an icon-only control, shown on hover and keyboard focus.", style: undefined, css: "", render: function () { return R(h(F.Tooltip, { label: 'Run fiddle', kbd: '\u2318R', open: true, placement: 'right' }, h(F.IconButton, { icon: 'play', label: 'Run', variant: 'primary' })),
  h('span', { style: { width: 150 } }), h(F.Tooltip, { label: 'Sign in to GitHub to publish', open: true, placement: 'right' }, h(F.Button, { disabled: true, icon: 'upload' }, 'Publish'))); } },
{ name: "Kbd", group: "Foundations", sub: "shortcut keycaps", summary: "Keycaps for shortcuts in menus, tooltips, the command palette and docs.", style: undefined, css: "", render: function () { function L(t, k) { return h('div', { className: 'fdx-line' }, h('span', null, t), h(F.Kbd, { keys: k })); }
return S(L('Run', ['\u2318', 'R']), L('Command palette', ['\u2318', '\u21e7', 'P']), L('Toggle console', ['\u2303', '`'])); } },
{ name: "Progress", group: "Feedback", sub: "version downloads, installs", summary: "Progress for Electron version downloads and module installs.", style: undefined, css: "", render: function () { return S(h(F.Progress, { label: 'Downloading 44.0.0-beta.3', detail: '62 / 104 MB', value: 60 }),
  h(F.Progress, { label: 'Installing modules' }), h(F.Progress, { label: 'Unzipped', detail: 'done', value: 100 })); } },
{ name: "Toast", group: "Feedback", sub: "transient confirmations and errors", summary: "A short, transient message: published, copied, crashed.", style: undefined, css: "", render: function () { return S(h(F.Toast, { tone: 'success', title: 'Published', action: 'Copy link', onClose: null }, 'gist.github.com/8f3a2c'),
  h(F.Toast, { tone: 'error', title: 'Fiddle crashed', action: 'Logs' }, 'Renderer exited with code 1.')); } },
{ name: "Dialog", group: "Overlays", sub: "shown inline", summary: "A modal task that needs a decision before continuing, such as publishing a fiddle.", style: undefined, css: ".pg-card[data-c=\"Dialog\"] .pg-card-body{background:var(--bg)}", render: function () { return h(F.Dialog, { inline: true, title: 'Publish fiddle', onClose: null, description: 'Creates a gist that anyone with the link can open.',
  footer: [h(F.Button, { key: 'c', variant: 'ghost' }, 'Cancel'), h(F.Button, { key: 'p', variant: 'primary', icon: 'upload' }, 'Publish')] },
  h(F.Input, { label: 'Description', defaultValue: 'Vibrancy on macOS' }), h(F.Checkbox, { label: 'Secret gist', defaultChecked: true })); } },
{ name: "Icon", group: "Foundations", sub: "16px, 1.5px stroke, currentColor", summary: "The icon set: 16px, 1.5px stroke, round caps, drawn in currentColor.", style: undefined, css: ".pg-card[data-c=\"Icon\"] .pg-card-body .ig{display:grid;grid-template-columns:repeat(auto-fill,minmax(28px,1fr));gap:6px;color:var(--ink-muted)}.pg-card[data-c=\"Icon\"] .pg-card-body .ig>span{display:grid;place-items:center;height:28px;border-radius:6px}", render: function () { return h('div', { className: 'ig' }, F.ICONS.map(function (n) { return h('span', { key: n, title: n }, h(F.Icon, { name: n })); })); } },
{ name: "TitleBar", group: "Layout", sub: "drag region, window controls, collapses at narrow widths", summary: "The window's top bar and drag region.", style: { padding: 0, maxWidth: "none", gap: 16 }, css: "", render: function () { var run = h(F.RunButton, { state: 'run' });
function bar(compact) { return h(F.TitleBar, { compact: compact, title: 'window-vibrancy', subtitle: 'Edited',
  start: h(F.IconButton, { icon: 'sidebar', label: 'Toggle sidebar' }),
  center: h(F.ControlGroup, null, h(F.Select, { size: 'md', defaultValue: '43', width: 150, options: [{ value: '43', label: 'Electron 43.0.0' }] }), run),
  end: [h(F.Button, { key: 'p', icon: 'upload' }, 'Publish'), h(F.IconButton, { key: 's', icon: 'gear', label: 'Settings' })] }); }
return [h('div', { key: 1 }, bar(false)), h('div', { key: 2, style: { maxWidth: 520 } }, bar(true))]; } },
{ name: "SplitPane", group: "Layout", sub: "drag a divider; double-click to reset", summary: "Resizable row and column splits.", style: { padding: 0, maxWidth: "none" }, css: "", render: function () { function P(t) { return h('div', { style: { padding: 12, color: 'var(--ink-muted)', fontSize: 12, background: 'var(--surface)', height: '100%', boxSizing: 'border-box' } }, t); }
return h('div', { style: { height: 280 } }, h(F.SplitPane, { direction: 'row', defaultSizes: [30, 70] },
  P('Sidebar'), h(F.SplitPane, { direction: 'column', defaultSizes: [65, 35] }, h(F.SplitPane, { direction: 'row' }, P('main.js'), P('renderer.js')), P('Console')))); } },
{ name: "Tile", group: "Layout", sub: "panel with severity title and actions", summary: "A panel with a header: title, process, severity and actions.", style: { maxWidth: "none" }, css: ".pg-card[data-c=\"Tile\"] .pg-card-body .tg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));height:260px}", render: function () { var MAIN = "const { app, BrowserWindow } = require('electron')\n\nfunction createWindow () {\n  const win = new BrowserWindow({ width: 800, height: 600 })\n  win.loadFile('index.html')\n}\n\napp.whenReady().then(createWindow)";
var REN = "const label = document.getElementById('vibrancy')\n\nasync function update () {\n  label.innerText = await window.api.getVibrancy()\n}";
var HTML = "<!DOCTYPE html>\n<html>\n  <body>\n    <h1 id=\"vibrancy\">Hello</h1>\n    <script src=\"./renderer.js\"><\/script>\n  </body>\n</html>";
var DIAG = [{ line: 4, match: 'api', title: 'TypeError', message: "Cannot read properties of undefined (reading 'getVibrancy')", hint: 'preload.js exposes window.electron, not window.api.' }];
return h('div', { className: 'tg' },
  h(F.Tile, { title: 'main.js', subtitle: 'Main process', focused: true }, h(F.CodeEditor, { file: 'main.js', value: MAIN, cursorLine: 4 })),
  h(F.Tile, { title: 'renderer.js', subtitle: 'Renderer', severity: 'error', count: 1 }, h(F.CodeEditor, { file: 'renderer.js', value: REN, diagnostics: [{ line: 4, match: 'api' }] }))); } },
{ name: "ControlGroup", group: "Layout", sub: "joined controls", summary: "Joins adjacent controls into one shape.", style: undefined, css: "", render: function () { return S(h(F.ControlGroup, null, h(F.Button, { icon: 'play' }, 'Run'), h(F.Button, null, 'Test'), h(F.Button, null, 'Bisect')),
  h(F.ControlGroup, null, h(F.Select, { defaultValue: '43', width: 160, options: [{ value: '43', label: 'Electron 43.0.0' }] }), h(F.Button, { variant: 'primary', icon: 'play' }, 'Run')),
  h(F.ControlGroup, null, h(F.Input, { placeholder: 'https://gist.github.com/\u2026', icon: 'link', style: { width: 240 } }), h(F.Button, null, 'Load'))); } },
{ name: "Fieldset", group: "Layout", sub: "disables everything inside while pending", summary: "Groups related settings and disables all of them while an action is pending.", style: undefined, css: "", render: function () { return h(F.Fieldset, { legend: 'GitHub account', pending: true },
  h(F.Input, { label: 'Personal access token', defaultValue: 'ghp_\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022', mono: true }),
  h(F.Checkbox, { label: 'Publish gists as secret by default', defaultChecked: true }),
  R(h(F.Button, { variant: 'primary' }, 'Save'), h(F.Button, { variant: 'ghost' }, 'Sign out'))); } },
{ name: "Page", group: "Layout", sub: "full-window settings page, shown inline", summary: "A full-window page with a side nav, used for Settings.", style: { maxWidth: "none" }, css: "", render: function () { return h(F.Page, { inline: true, height: 400, title: 'Settings', onClose: null, defaultValue: 'exec',
  nav: [{ id: 'general', label: 'General', icon: 'gear' }, { id: 'appearance', label: 'Appearance', icon: 'palette' }, { id: 'exec', label: 'Execution', icon: 'play' },
    { id: 'versions', label: 'Electron versions', icon: 'download' }, { id: 'accounts', label: 'Accounts', icon: 'user' }, { id: 'keys', label: 'Keyboard', icon: 'keyboard' }] },
  h(F.Heading, { level: 2 }, 'Execution'),
  h(F.FormField, { label: 'Electron flags', helper: 'Passed to Electron when a fiddle runs.' }, h(F.InputList, { defaultValues: ['--enable-logging', '--js-flags=--expose-gc'], placeholder: '--flag' })),
  h(F.RadioGroup, { label: 'Clear the console', inline: true, defaultValue: 'run', options: [{ value: 'run', label: 'On every run' }, { value: 'never', label: 'Never' }] })); } },
{ name: "Divider", group: "Layout", sub: "plain or labelled", summary: "A hairline between groups, optionally labelled.", style: undefined, css: "", render: function () { return S(h(F.Text, { muted: true }, 'Above'), h(F.Divider), h(F.Divider, { label: 'or start from an example' }), h(F.Text, { muted: true }, 'Below')); } },
{ name: "ScrollArea", group: "Layout", sub: "thin themed scrollbar", summary: "A scroll container with the thin themed scrollbar.", style: undefined, css: "", render: function () { var rows = []; for (var i = 1; i <= 24; i++) rows.push(h('div', { key: i, style: { padding: '4px 0', borderBottom: '1px solid var(--line)' } }, 'Electron ' + (44 - Math.floor(i / 4)) + '.' + (i % 4) + '.0'));
return h(F.ScrollArea, { height: 140 }, rows); } },
{ name: "Heading", group: "Typography", sub: "four levels", summary: "Headings in four levels.", style: undefined, css: "", render: function () { return S(h(F.Heading, { level: 1 }, 'Build it in a fiddle'), h(F.Heading, { level: 2 }, 'Electron settings'), h(F.Heading, { level: 3 }, 'Installed versions'), h(F.Heading, { level: 4 }, 'Section label')); } },
{ name: "Text", group: "Typography", sub: "body, muted, small, mono", summary: "Body text, with muted, small and mono variants.", style: undefined, css: "", render: function () { return S(h(F.Text, null, 'Choose which Electron version runs your fiddle.'), h(F.Text, { muted: true }, 'Downloaded versions are kept between sessions.'),
  h(F.Text, { muted: true, small: true }, 'Last run 2 minutes ago'), h(F.Text, { mono: true }, '~/Library/Application Support/Electron Fiddle')); } },
{ name: "Code", group: "Typography", sub: "inline code", summary: "Inline code inside running text.", style: undefined, css: "", render: function () { return h(F.Text, null, 'Expose APIs with ', h(F.Code, null, 'contextBridge.exposeInMainWorld'), ' from ', h(F.Code, null, 'preload.js'), '.'); } },
{ name: "Link", group: "Typography", sub: "inline and external", summary: "Inline links; `external` adds the arrow and opens in the browser.", style: undefined, css: "", render: function () { return h(F.Text, null, 'Read the ', h(F.Link, null, 'process model'), ' guide, or open the ', h(F.Link, { external: true }, 'Electron docs'), '.'); } },
{ name: "RunButton", group: "Actions", sub: "run \u00b7 stop \u00b7 busy \u00b7 downloading", summary: "The Run control, with four states: run, stop (pressed), busy (indeterminate) and downloading (determinate).", style: undefined, css: "", render: function () { return C(R(h(F.RunButton, { state: 'run' }), h(F.RunButton, { state: 'stop', version: '43.0.0' })), R(h(F.RunButton, { state: 'busy' }), h(F.RunButton, { state: 'downloading', progress: 0.62 }))); } },
{ name: "SplitButton", group: "Actions", sub: "main action with menus on its sides", summary: "A main action with menu triggers attached to its sides.", style: undefined, css: "", render: function () { return C(h(F.SplitButton, { label: 'Run', icon: 'play', kbd: '\u2318R', endItems: [{ label: 'Run', icon: 'play', kbd: '\u2318R' }, { label: 'Run with inspector', icon: 'code' }, { label: 'Bisect from here', icon: 'branch' }] }),
  h(F.SplitButton, { variant: 'secondary', label: 'Publish', icon: 'upload', startLabel: 'Secret', startItems: [{ label: 'Secret gist', checked: true }, { label: 'Public gist', checked: false }], endItems: [{ label: 'Publish as new gist' }, { label: 'Update existing gist' }] })); } },
{ name: "UrlInput", group: "Inputs", sub: "widens when filled, validates", summary: "The gist address field.", style: undefined, css: "", render: function () { return S(h(F.UrlInput, null), h(F.UrlInput, { defaultValue: 'https://gist.github.com/felixr/8f3a2c91' }), h(F.UrlInput, { defaultValue: 'github.com/electron/fiddle' })); } },
{ name: "InputList", group: "Inputs", sub: "repeatable rows", summary: "A list of inputs where each row can be removed (never the last one) and new rows added.", style: undefined, css: "", render: function () { return h(F.InputList, { label: 'Environment variables', defaultValues: ['ELECTRON_ENABLE_LOGGING=1', 'DEBUG=electron*'], placeholder: 'NAME=value', addLabel: 'Add variable' }); } },
{ name: "RadioGroup", group: "Inputs", sub: "stacked or inline", summary: "One choice from a few visible options, stacked or inline.", style: undefined, css: "", render: function () { return S(h(F.RadioGroup, { label: 'Theme', defaultValue: 'system', options: [{ value: 'system', label: 'Match the system' }, { value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }] }),
  h(F.RadioGroup, { label: 'Architecture', inline: true, defaultValue: 'arm64', options: [{ value: 'arm64', label: 'arm64' }, { value: 'x64', label: 'x64' }, { value: 'ia32', label: 'ia32', disabled: true }] })); } },
{ name: "FilePicker", group: "Inputs", sub: "placeholder or chosen path", summary: "Chooses a file or folder, showing the chosen path or a placeholder.", style: undefined, css: "", render: function () { return S(h(F.FilePicker, { label: 'Local Electron build', helper: 'Use a build from your own checkout instead of a release.' }),
  h(F.FilePicker, { label: 'Fiddles folder', value: '~/Code/fiddles' })); } },
{ name: "CompactSelect", group: "Inputs", sub: "small native select for rows", summary: "A small native select for use inside list rows, such as a package's version.", style: undefined, css: "", render: function () { return R(h(F.Text, { as: 'span' }, 'electron-store'), h(F.CompactSelect, { label: 'Version', defaultValue: '10.0.1', options: ['10.0.1', '10.0.0', '9.0.0', '8.2.0'] })); } },
{ name: "FormField", group: "Inputs", sub: "label, control, helper; stacked or inline", summary: "A label, a control and helper text, stacked or inline, with a disabled state.", style: undefined, css: "", render: function () { return S(h(F.FormField, { label: 'Font size', helper: 'Applies to editors and the console.' }, h(F.CompactSelect, { defaultValue: '13', options: ['12', '13', '14', '16'] })),
  h(F.FormField, { label: 'Autosave', inline: true, helper: 'Saves to disk after 2 seconds without typing.' }, h(F.Switch, { defaultChecked: true, label: 'On' })),
  h(F.FormField, { label: 'Telemetry', disabled: true, helper: 'Managed by your organization.' }, h(F.Switch, { label: 'Off' }))); } },
{ name: "FilterableSelect", group: "Selection", sub: "search, highlight, sections, disabled items", summary: "A dropdown with a search box.", style: { minHeight: 230 }, css: "", render: function () { return h(F.FilterableSelect, { width: 280, defaultOpen: true, defaultQuery: 'tray', defaultValue: 'tray', placeholder: 'Choose an example', searchPlaceholder: 'Filter examples',
  items: [{ heading: 'Native UI' }, { value: 'tray', label: 'Tray icon and menu', icon: 'window', hint: 'main' }, { value: 'menus', label: 'Application menus', icon: 'window', hint: 'main' },
    { value: 'dialogs', label: 'Native dialogs', icon: 'window', hint: 'main' }, { heading: 'System' }, { value: 'notif', label: 'Notifications', icon: 'bell', hint: 'renderer' },
    { value: 'traybadge', label: 'Dock and tray badges', icon: 'bell', hint: 'main', disabled: true, reason: 'macOS only' }, { value: 'power', label: 'Power monitor', icon: 'sparkle', hint: 'main' }] }); } },
{ name: "Suggest", group: "Selection", sub: "debounced search, clears after a pick", summary: "Autocomplete with debounced search.", style: { minHeight: 190 }, css: "", render: function () { var NPM = [{ name: 'lodash', version: '4.17.21', description: 'Utility library' }, { name: 'lodash-es', version: '4.17.21', description: 'Lodash as ES modules' },
  { name: 'electron-store', version: '10.0.1', description: 'Simple data persistence' }, { name: 'electron-log', version: '5.2.0', description: 'Logging for main and renderer' },
  { name: 'three', version: '0.170.0', description: '3D library' }];
return h('div', { style: { width: 320 } }, h(F.Suggest, { source: NPM, defaultQuery: 'lod', delay: 0 })); } },
{ name: "ContextMenu", group: "Selection", sub: "opens at the cursor; shown open", summary: "A menu that opens at the cursor on right-click, or attached to an element.", style: { minHeight: 240 }, css: "", render: function () { return h(F.ContextMenu, { open: true, x: 120, y: 26, items: [{ label: 'Rename', icon: 'file', kbd: 'F2' }, { label: 'Duplicate', icon: 'copy' }, { label: 'Hide editor', icon: 'eye-off' }, { separator: true }, { label: 'Open in a new window', icon: 'popout', intent: 'primary' }, { label: 'Delete file', icon: 'trash', danger: true }] },
  h('div', { style: { padding: '8px 10px', border: '1px dashed var(--line-strong)', borderRadius: 6, color: 'var(--ink-muted)', width: 200 } }, 'Right-click renderer.js')); } },
{ name: "AlertDialog", group: "Overlays", sub: "warning \u00b7 confirm \u00b7 success, optional input", summary: "A short confirmation: warning, confirm or success.", style: { maxWidth: 440 }, css: ".pg-card[data-c=\"AlertDialog\"] .pg-card-body{background:var(--bg)}", render: function () { return S(h(F.AlertDialog, { intent: 'warning', title: 'Discard unsaved changes?', confirmLabel: 'Discard', cancelLabel: 'Keep editing' }, 'renderer.js and styles.css have changes that are not saved.'),
  h(F.AlertDialog, { intent: 'confirm', title: 'Name this fiddle', input: 'window-vibrancy', confirmLabel: 'Save' }),
  h(F.AlertDialog, { intent: 'success', title: 'Published', cancelLabel: null, confirmLabel: 'Copy link' }, 'Anyone with the link can open this fiddle.')); } },
{ name: "Popover", group: "Overlays", sub: "anchored with an arrow; shown open", summary: "Anchored floating content with an arrow.", style: { minHeight: 190, alignItems: "flex-start" }, css: "", render: function () { return h('div', { style: { paddingLeft: 90 } }, h(F.Popover, { open: true, width: 240, content: h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
  h('b', null, 'Electron 43.0.0'), h(F.Text, { muted: true, small: true }, 'Chromium, Node and V8 versions ship with each release.'), h(F.Link, { external: true }, 'Release notes')) },
  h(F.Button, { icon: 'info' }, 'Version info'))); } },
{ name: "ToastStack", group: "Overlays", sub: "stacked notifications", summary: "Stacks toasts, newest last, each with a message and an optional action.", style: undefined, css: "", render: function () { return h(F.ToastStack, { toasts: [{ tone: 'success', title: 'Published', children: 'gist.github.com/8f3a2c', action: 'Copy link', onClose: null },
  { tone: 'info', title: 'Electron 44.0.0-beta.3 is ready', action: 'Switch' }, { tone: 'warning', title: 'Package not found', children: 'lodahs is not on npm.', onClose: null }] }); } },
{ name: "Coachmark", group: "Overlays", sub: "tour step with a cut-out", summary: "One step of a guided tour.", style: { padding: 0, maxWidth: "none" }, css: "", render: function () { return h('div', { style: { position: 'relative', height: 280, background: 'var(--bg)' } },
  h('div', { style: { display: 'flex', gap: 8, padding: 16 } }, h(F.Select, { defaultValue: '43', width: 170, options: [{ value: '43', label: 'Electron 43.0.0' }] }), h('span', { id: 'tour-run' }, h(F.RunButton, { state: 'run' })), h(F.Button, { icon: 'upload' }, 'Publish')),
  h(F.Coachmark, { target: '#tour-run', step: 2, total: 4, title: 'Run your fiddle' }, 'Starts Electron with your code. Press it again to stop. Shortcut: \u2318R.')); } },
{ name: "Spinner", group: "Feedback", sub: "ring: indeterminate or 0 to 1, two sizes; loading block", summary: "A progress ring, either indeterminate or determinate (0 to 1), in two sizes.", style: undefined, css: "", render: function () { return S(R(h(F.Spinner), h(F.Spinner, { value: 0.35 }), h(F.Spinner, { size: 'md' }), h(F.Spinner, { size: 'md', value: 0.72 })), h(F.LoadingBlock, { label: 'Loading release list', height: 110 })); } },
{ name: "LoadingBlock", group: "Feedback", sub: "centred spinner with caption", summary: "A centred spinner with a caption, for panels that are still loading.", style: undefined, css: "", render: function () { return h(F.LoadingBlock, { label: 'Fetching examples', height: 120 }); } },
{ name: "Callout", group: "Feedback", sub: "neutral, primary and danger", summary: "An inline note in a neutral, primary or danger variant.", style: undefined, css: "", render: function () { return S(h(F.Callout, { title: 'Sandboxed by default' }, 'Renderers have no Node.js access. Use preload.js to expose what they need.'),
  h(F.Callout, { intent: 'primary', title: 'New in Electron 43', action: h(F.Link, null, 'See what changed') }, 'The Tray API supports template images on Windows.'),
  h(F.Callout, { intent: 'danger', title: 'Electron 40 is no longer supported' }, 'It stops receiving security fixes. Pick a newer version to keep testing.')); } },
{ name: "EmptyState", group: "Feedback", sub: "icon, title, text, action", summary: "What a panel shows when it has nothing yet: an icon, a title, a sentence and one action.", style: undefined, css: "", render: function () { return h(F.EmptyState, { icon: 'code', title: 'No editors open', action: h(F.Button, { icon: 'plus' }, 'New file') }, 'Pick a file in the sidebar, or start from one of the examples.'); } },
{ name: "Table", group: "Data", sub: "virtualized, sections, zebra, empty message", summary: "A virtualized table with section headers, zebra rows, hover, selection and an empty message.", style: undefined, css: "", render: function () { var VERS = [
  { version: '43.0.0', channel: 'stable', state: 'installed', size: '104 MB' }, { version: '42.4.1', channel: 'stable', state: 'installed', size: '102 MB' },
  { version: '42.3.0', channel: 'stable', state: 'remote', size: '102 MB' }, { version: '41.6.2', channel: 'stable', state: 'remote', size: '99 MB' },
  { version: '41.5.0', channel: 'stable', state: 'remote', size: '99 MB' }, { version: '40.9.1', channel: 'stable', state: 'remote', size: '97 MB', disabled: true, reason: 'Not available for arm64' },
  { version: '44.0.0-beta.3', channel: 'beta', state: 'downloading', progress: 0.62, size: '106 MB' }, { version: '44.0.0-beta.2', channel: 'beta', state: 'remote', size: '106 MB' },
  { version: '45.0.0-nightly.20260910', channel: 'nightly', state: 'remote', size: '108 MB' }, { version: '45.0.0-nightly.20260909', channel: 'nightly', state: 'remote', size: '108 MB' }];
var rows = [{ section: 'Stable' }].concat(VERS.filter(function (v) { return v.channel === 'stable'; }).map(function (v) { return Object.assign({ id: v.version }, v); }), [{ section: 'Beta' }], VERS.filter(function (v) { return v.channel === 'beta'; }).map(function (v) { return Object.assign({ id: v.version }, v); }));
return h(F.Table, { height: 250, columns: [{ key: 'version', label: 'Version', mono: true }, { key: 'channel', label: 'Channel' }, { key: 'size', label: 'Size', mono: true, align: 'right', width: '90px' }], rows: rows }); } },
{ name: "StatusCell", group: "Data", sub: "icon plus text", summary: "An icon plus text for a row's state: ok, busy (with progress), remote or error.", style: undefined, css: "", render: function () { return C(h(F.StatusCell, { status: 'ok' }, 'Downloaded'), h(F.StatusCell, { status: 'busy', progress: 0.62 }, 'Downloading 62%'), h(F.StatusCell, { status: 'remote' }, 'Not downloaded'), h(F.StatusCell, { status: 'error' }, 'Checksum failed')); } },
{ name: "Tag", group: "Data", sub: "neutral \u00b7 primary \u00b7 success \u00b7 danger", summary: "A short label in neutral, primary, success or danger, and optionally removable.", style: undefined, css: "", render: function () { return R(h(F.Tag, null, 'arm64'), h(F.Tag, { tone: 'primary' }, 'beta'), h(F.Tag, { tone: 'success' }, 'stable'), h(F.Tag, { tone: 'danger' }, 'unsupported'), h(F.Tag, { tone: 'primary', onRemove: function () {} }, 'electron-store')); } },
{ name: "ListRow", group: "Data", sub: "selectable rows with meta and tags", summary: "A selectable row with an icon, a title, mono metadata and tags.", style: undefined, css: "", render: function () { return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 420 } },
  h(F.ListRow, { icon: 'window', title: 'window-vibrancy', meta: 'gist 8f3a2c · edited 2 min ago', active: true, tags: [{ label: 'secret' }] }),
  h(F.ListRow, { icon: 'window', title: 'tray-menu', meta: 'gist 1b7e40 · edited yesterday', tags: [{ label: 'public', tone: 'primary' }] }),
  h(F.ListRow, { icon: 'file', title: 'untitled-3', meta: 'not saved', tags: [{ label: 'draft', tone: 'warning' }] })); } },
{ name: "Card", group: "Data", sub: "clickable, avatar, secondary text", summary: "A clickable card with an avatar or icon, a title and secondary text.", style: { maxWidth: 560 }, css: ".pg-card[data-c=\"Card\"] .pg-card-body .cg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}", render: function () { return h('div', { className: 'cg' }, h(F.Card, { icon: 'window', title: 'Hello World', secondary: 'A window with a preload script' }), h(F.Card, { icon: 'bell', title: 'Notifications', secondary: 'Native notifications from the renderer' }),
  h(F.Card, { avatar: 'Felix Rieseberg', title: 'Felix Rieseberg', secondary: 'Signed in to GitHub' }), h(F.Card, { icon: 'book', title: 'Tray', secondary: 'From the Electron docs' })); } },
{ name: "SideNav", group: "Navigation", sub: "vertical list with active state", summary: "Vertical navigation with icons, an active item and badges.", style: { maxWidth: 240 }, css: "", render: function () { return h(F.SideNav, { defaultValue: 'versions', items: [{ id: 'general', label: 'General', icon: 'gear' }, { id: 'appearance', label: 'Appearance', icon: 'palette' }, { id: 'exec', label: 'Execution', icon: 'play' },
  { id: 'versions', label: 'Electron versions', icon: 'download', badge: '3' }, { id: 'accounts', label: 'Accounts', icon: 'user' }, { id: 'keys', label: 'Keyboard', icon: 'keyboard' }] }); } },
{ name: "CodeEditor", group: "App", sub: "themed, diagnostics inline", summary: "The editor's look: a themed stand-in for Monaco.", style: { padding: 0, maxWidth: "none", gap: 0 }, css: "", render: function () { var MAIN = "const { app, BrowserWindow } = require('electron')\n\nfunction createWindow () {\n  const win = new BrowserWindow({ width: 800, height: 600 })\n  win.loadFile('index.html')\n}\n\napp.whenReady().then(createWindow)";
var REN = "const label = document.getElementById('vibrancy')\n\nasync function update () {\n  label.innerText = await window.api.getVibrancy()\n}";
var HTML = "<!DOCTYPE html>\n<html>\n  <body>\n    <h1 id=\"vibrancy\">Hello</h1>\n    <script src=\"./renderer.js\"><\/script>\n  </body>\n</html>";
var DIAG = [{ line: 4, match: 'api', title: 'TypeError', message: "Cannot read properties of undefined (reading 'getVibrancy')", hint: 'preload.js exposes window.electron, not window.api.' }];
return [h(F.CodeEditor, { key: 1, file: 'renderer.js', value: REN, diagnostics: DIAG, height: 190 }), h(F.CodeEditor, { key: 2, file: 'index.html', value: HTML, cursorLine: 4, height: 150 })]; } },
{ name: "EditorGrid", group: "App", sub: "tiles arrange themselves; empty state", summary: "Arranges editor tiles automatically.", style: { maxWidth: "none" }, css: "", render: function () { var MAIN = "const { app, BrowserWindow } = require('electron')\n\nfunction createWindow () {\n  const win = new BrowserWindow({ width: 800, height: 600 })\n  win.loadFile('index.html')\n}\n\napp.whenReady().then(createWindow)";
var REN = "const label = document.getElementById('vibrancy')\n\nasync function update () {\n  label.innerText = await window.api.getVibrancy()\n}";
var HTML = "<!DOCTYPE html>\n<html>\n  <body>\n    <h1 id=\"vibrancy\">Hello</h1>\n    <script src=\"./renderer.js\"><\/script>\n  </body>\n</html>";
var DIAG = [{ line: 4, match: 'api', title: 'TypeError', message: "Cannot read properties of undefined (reading 'getVibrancy')", hint: 'preload.js exposes window.electron, not window.api.' }];
return S(h(F.EditorGrid, { height: 300, files: [{ name: 'main.js', process: 'Main process', code: MAIN, focused: true }, { name: 'renderer.js', process: 'Renderer', code: REN, diagnostics: [{ line: 4, match: 'api' }] }, { name: 'index.html', process: 'Renderer', code: HTML }] }),
  h(F.EditorGrid, { height: 200, files: [] })); } },
{ name: "Console", group: "App", sub: "timestamps in the gutter, filters, auto-scroll", summary: "Read-only output with timestamps in the gutter.", style: { padding: 0, maxWidth: "none" }, css: "", render: function () { return h(F.Console, { height: 230, running: true, lines: [{ time: '19:42:07', process: 'Fiddle', level: 'system', text: 'Started Electron 43.0.0 (arm64)' }, { time: '19:42:07', process: 'Main', text: 'App ready, creating window' },
  { time: '19:42:08', process: 'Renderer', text: 'Loaded index.html' }, { time: '19:42:08', process: 'Renderer', level: 'warn', text: 'Electron Security Warning (Insecure Content-Security-Policy)' },
  { time: '19:42:08', process: 'Renderer', level: 'error', text: "Uncaught TypeError: Cannot read properties of undefined (reading 'getVibrancy')", link: 'renderer.js:4:36' }, { time: '19:42:09', process: 'Main', text: 'Window closed' }] }); } },
{ name: "VersionPicker", group: "App", sub: "install state per version; shown open", summary: "The Electron version picker: a filterable select that shows each version's install state.", style: { minHeight: 420 }, css: "", render: function () { var VERS = [
  { version: '43.0.0', channel: 'stable', state: 'installed', size: '104 MB' }, { version: '42.4.1', channel: 'stable', state: 'installed', size: '102 MB' },
  { version: '42.3.0', channel: 'stable', state: 'remote', size: '102 MB' }, { version: '41.6.2', channel: 'stable', state: 'remote', size: '99 MB' },
  { version: '41.5.0', channel: 'stable', state: 'remote', size: '99 MB' }, { version: '40.9.1', channel: 'stable', state: 'remote', size: '97 MB', disabled: true, reason: 'Not available for arm64' },
  { version: '44.0.0-beta.3', channel: 'beta', state: 'downloading', progress: 0.62, size: '106 MB' }, { version: '44.0.0-beta.2', channel: 'beta', state: 'remote', size: '106 MB' },
  { version: '45.0.0-nightly.20260910', channel: 'nightly', state: 'remote', size: '108 MB' }, { version: '45.0.0-nightly.20260909', channel: 'nightly', state: 'remote', size: '108 MB' }];
return h(F.VersionPicker, { versions: VERS, defaultValue: '43.0.0', defaultOpen: true, width: 300 }); } },
{ name: "ModuleList", group: "App", sub: "npm search plus installed rows", summary: "The fiddle's npm packages: a search box to add one, and a row per package with its version and a remove button.", style: undefined, css: "", render: function () { var NPM = [{ name: 'lodash', version: '4.17.21', description: 'Utility library' }, { name: 'lodash-es', version: '4.17.21', description: 'Lodash as ES modules' },
  { name: 'electron-store', version: '10.0.1', description: 'Simple data persistence' }, { name: 'electron-log', version: '5.2.0', description: 'Logging for main and renderer' },
  { name: 'three', version: '0.170.0', description: '3D library' }];
return h(F.ModuleList, { source: NPM, modules: [{ name: 'lodash', version: '4.17.21', versions: ['4.17.21', '4.17.20'] }, { name: 'electron-store', version: '10.0.1', versions: ['10.0.1', '10.0.0', '9.0.0'] }] }); } },
{ name: "VersionManager", group: "App", sub: "bulk actions, filters, table", summary: "Manages downloaded Electron versions.", style: { maxWidth: "none" }, css: "", render: function () { var VERS = [
  { version: '43.0.0', channel: 'stable', state: 'installed', size: '104 MB' }, { version: '42.4.1', channel: 'stable', state: 'installed', size: '102 MB' },
  { version: '42.3.0', channel: 'stable', state: 'remote', size: '102 MB' }, { version: '41.6.2', channel: 'stable', state: 'remote', size: '99 MB' },
  { version: '41.5.0', channel: 'stable', state: 'remote', size: '99 MB' }, { version: '40.9.1', channel: 'stable', state: 'remote', size: '97 MB', disabled: true, reason: 'Not available for arm64' },
  { version: '44.0.0-beta.3', channel: 'beta', state: 'downloading', progress: 0.62, size: '106 MB' }, { version: '44.0.0-beta.2', channel: 'beta', state: 'remote', size: '106 MB' },
  { version: '45.0.0-nightly.20260910', channel: 'nightly', state: 'remote', size: '108 MB' }, { version: '45.0.0-nightly.20260909', channel: 'nightly', state: 'remote', size: '108 MB' }];
return h(F.VersionManager, { versions: VERS, height: 320 }); } }
];
var DIRS = { electron: {"window": {"assist": {"placeholder": "Describe a change to this fiddle", "button": "Suggest", "icon": "sparkle", "variant": "secondary", "kbd": "\u2318\u21b5"}}} };
var GROUPS = ['Layout', 'Typography', 'Actions', 'Inputs', 'Selection', 'Navigation', 'Overlays', 'Feedback', 'Data', 'App', 'Foundations'];
/* ---------- live window ---------- */
var W_MAIN = "const { app, BrowserWindow, ipcMain } = require('electron')\nconst path = require('node:path')\n\nfunction createWindow () {\n  const win = new BrowserWindow({\n    width: 800,\n    height: 600,\n    vibrancy: 'under-window',\n    webPreferences: {\n      preload: path.join(__dirname, 'preload.js')\n    }\n  })\n  win.loadFile('index.html')\n}\n\nipcMain.handle('get-vibrancy', () => 'under-window')\napp.whenReady().then(createWindow)";
var W_REN = "const label = document.getElementById('vibrancy')\n\nasync function update () {\n  label.innerText = await window.api.getVibrancy()\n}\n\nupdate()";
var W_PRE = "const { contextBridge, ipcRenderer } = require('electron')\n\ncontextBridge.exposeInMainWorld('electron', {\n  getVibrancy: () => ipcRenderer.invoke('get-vibrancy')\n})";
var W_VERS = [{ heading: 'Stable' }, { value: '43.0.0', label: 'Electron 43.0.0', hint: 'latest' }, { value: '42.4.1', label: 'Electron 42.4.1' }, { separator: true }, { heading: 'Pre-release' }, { value: '44b', label: 'Electron 44.0.0-beta.3', hint: 'beta' }];
var W_LOG_IDLE = [{ time: '19:41:02', process: 'Fiddle', level: 'system', text: 'Ready. Press Run to start Electron 43.0.0.' }];
var W_LOG_RUN = [{ time: '19:42:07', process: 'Fiddle', level: 'system', text: 'Started Electron 43.0.0 (arm64)' }, { time: '19:42:07', process: 'Main', text: 'App ready, creating window' },
  { time: '19:42:08', process: 'Renderer', text: 'Loaded index.html' }, { time: '19:42:08', process: 'Renderer', level: 'error', text: "Uncaught TypeError: Cannot read properties of undefined (reading 'getVibrancy')", link: 'renderer.js:4:36' }];
var W_FILES = {
  main: { name: 'main.js', process: 'Main process', code: W_MAIN, cursor: 8 },
  pre: { name: 'preload.js', process: 'Preload', code: W_PRE, cursor: 3 },
  ren: { name: 'renderer.js', process: 'Renderer', code: W_REN, cursor: 4 },
  html: { name: 'index.html', process: 'Renderer', code: "<!DOCTYPE html>\n<html>\n  <head>\n    <link rel=\"stylesheet\" href=\"styles.css\">\n  </head>\n  <body>\n    <h1>Vibrancy: <span id=\"vibrancy\">\u2026</span></h1>\n    <script src=\"./renderer.js\"><\/script>\n  </body>\n</html>", cursor: 7 },
  css: { name: 'styles.css', process: 'Renderer', code: "html {\n  background: transparent;\n  color: white;\n  font: 600 32px system-ui;\n}", cursor: 2 }
};
var W_DIAG = [{ line: 4, match: 'api', title: 'TypeError', message: "Cannot read properties of undefined (reading 'getVibrancy')", hint: 'preload.js exposes window.electron, not window.api.' }];
function AppWindow(p) {
  var D = DIRS[p.dir] || {}, assist = D.window && D.window.assist;
  var st = React.useState('run'), run = st[0], setRun = st[1];
  var tb = React.useState('main'), tab = tb[0], setTab = tb[1];
  var sp = React.useState(false), split = sp[0], setSplit = sp[1];
  var click = function () {
    if (run === 'run') { setRun('busy'); setTimeout(function () { setRun('stop'); }, 700); } else if (run === 'stop') setRun('run');
  };
  var running = run === 'stop';
  var diag = function (id) { return running && id === 'ren' ? W_DIAG : []; };
  var order = ['main', 'pre', 'ren', 'html', 'css'];
  var tabs = order.map(function (id) { return { id: id, label: W_FILES[id].name, dirty: id === 'ren', errors: running && id === 'ren' ? 1 : 0 }; });
  var other = tab === 'ren' ? 'main' : 'ren';
  var f = W_FILES[tab];
  var editor = split
    ? h(F.EditorGrid, { height: '100%', files: [tab, other].map(function (id, i) { var x = W_FILES[id]; return { name: x.name, process: x.process, code: x.code, cursorLine: x.cursor, focused: i === 0, diagnostics: diag(id) }; }) })
    : h(F.CodeEditor, { file: f.name, value: f.code, cursorLine: f.cursor, diagnostics: diag(tab) });
  var day = new Date(), clock = day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }) + '  ' + day.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  var tree = function (items) { return h(F.FileTree, { items: items, value: tab, onSelect: function (id) { if (W_FILES[id]) setTab(id); }, visibility: false }); };
  return h('div', { className: 'pg-winscroll' }, h('div', { className: 'pg-desk', 'data-running': running ? '' : undefined, 'data-busy': run === 'busy' ? '' : undefined, 'data-split': split ? '' : undefined, 'data-tab': tab },
    running ? h('div', { className: 'pg-appwin', role: 'img', 'aria-label': 'The running fiddle window' }, h('div', { className: 'pg-appwin-bar' }, h('i'), h('i'), h('i'), h('span', null, 'Hello World!')), h('div', { className: 'pg-appwin-body' }, 'Vibrancy:\u00a0', h('em', null, '\u2026'))) : null,
    h('div', { className: 'pg-win' },
    h(F.TitleBar, { title: 'window-vibrancy', subtitle: 'Edited',
      start: h(F.IconButton, { icon: 'sidebar', label: 'Toggle sidebar' }),
      center: h(F.ControlGroup, null, h(F.Select, { defaultValue: '43.0.0', width: 180, options: W_VERS }), h(F.RunButton, { state: run, version: '43.0.0', onClick: click })),
      end: [h(F.Button, { key: 'p', icon: 'upload' }, 'Publish'), h(F.IconButton, { key: 's', icon: 'gear', label: 'Settings' })] }),
    h('div', { className: 'pg-win-body' },
      h('div', { className: 'pg-win-side' },
        h(F.Heading, { level: 4 }, 'Main process'), tree([{ id: 'main', name: 'main.js' }]),
        h(F.Heading, { level: 4 }, 'Preload'), tree([{ id: 'pre', name: 'preload.js' }]),
        h(F.Heading, { level: 4 }, 'Renderer'), tree([{ id: 'html', name: 'index.html' }, { id: 'ren', name: 'renderer.js', dirty: true, badge: running ? '1 error' : undefined }, { id: 'css', name: 'styles.css' }]),
        h(F.Heading, { level: 4 }, 'Packages'), h(F.Input, { size: 'sm', icon: 'search', placeholder: 'Add a package' })),
      h('div', { className: 'pg-win-main' },
        h('div', { className: 'pg-edhead' },
          h(F.Tabs, { tabs: tabs, value: tab, onChange: setTab }),
          split ? null : h('span', { className: 'pg-edproc' }, f.process),
          h(F.Tooltip, { label: split ? 'Close split' : 'Split editor', kbd: '\u2318\\', placement: 'bottom' }, h(F.IconButton, { icon: 'columns', size: 'sm', label: split ? 'Close split' : 'Split editor', pressed: split, onClick: function () { setSplit(!split); } }))),
        h('div', { className: 'pg-edbody' }, editor),
        assist ? h('div', { className: 'pg-assist' }, h(F.Input, { size: 'sm', icon: assist.icon || 'sparkle', placeholder: assist.placeholder || 'Describe a change' }), assist.button ? h(F.Button, { size: 'sm', variant: assist.variant || 'secondary', kbd: assist.kbd }, assist.button) : null) : null,
        h(F.Console, { height: 160, running: running, lines: running ? W_LOG_RUN : W_LOG_IDLE }))),
    h('div', { className: 'pg-status' }, running ? h('span', { className: 'live' }, 'Running') : h('span', null, 'Ready'), h('span', null, 'Electron 43.0.0'), h('span', null, 'arm64'), h('span', { style: { flex: 1 } }), h('span', null, 'Ln ' + f.cursor + ', Col 5'), h('span', null, f.name.split('.').pop() === 'js' ? 'JavaScript' : f.name.split('.').pop().toUpperCase())))));
}

var Card = React.memo(function Card(p) {
  var c = p.card, out;
  try { out = c.render(); } catch (e) { out = h('div', { style: { color: 'var(--spark)' } }, 'Preview failed: ' + e.message); }
  return h('section', { className: 'pg-card', 'data-c': c.name, id: 'c-' + c.name },
    h('div', { className: 'pg-card-head' }, h('b', null, c.name), h('span', null, c.sub)),
    c.summary ? h('div', { className: 'pg-card-sum' }, c.summary) : null,
    c.css ? h('style', null, c.css) : null,
    h('div', { className: 'pg-card-body', style: c.style }, out));
});

function RunStates() {
  var vers = [{ value: '43.0.0', label: 'Electron 43.0.0' }];
  var rows = [['run', 'Ready', 'Press to run'], ['downloading', 'Downloading', 'Version not installed'], ['busy', 'Starting', 'About 0.7s'], ['stop', 'Running', 'Press to stop']];
  return h(React.Fragment, null, rows.map(function (r) {
    return h('div', { className: 'hd-runrow', key: r[0] }, h('b', null, r[1], h('small', null, r[2])),
      h('div', { className: 'hd-runbar' }, h(F.TitleBar, { title: 'window-vibrancy', subtitle: 'Edited',
        center: h(F.ControlGroup, null, h(F.Select, { defaultValue: '43.0.0', width: 180, options: vers }), h(F.RunButton, { state: r[0], progress: 0.42, version: '43.0.0' })) })));
  }));
}
function Gallery() {
  return h(React.Fragment, null, GROUPS.map(function (g) {
    var list = CARDS.filter(function (c) { return c.group === g; }); if (!list.length) return null;
    return h('div', { className: 'hd-group', key: g }, h('h3', null, g, h('span', null, list.length + (list.length === 1 ? ' component' : ' components'))),
      h('div', { className: 'pg-cards' }, list.map(function (c) { return h(Card, { key: c.name, card: c }); })));
  }));
}
ReactDOM.createRoot(document.getElementById('spec-window')).render(h(AppWindow, { dir: 'electron' }));
ReactDOM.createRoot(document.getElementById('spec-run')).render(h(RunStates));
ReactDOM.createRoot(document.getElementById('spec-gallery')).render(h(Gallery));

/* appearance toggle */
(function () {
  function set(m) {
    document.body.setAttribute('data-theme', 'electron-' + m);
    ['dark', 'light'].forEach(function (x) { var b = document.getElementById('mode-' + x); if (b) b.setAttribute('aria-pressed', String(x === m)); });
    try { document.documentElement.style.backgroundColor = getComputedStyle(document.body).backgroundColor; } catch (e) {}
    try { localStorage.setItem('lucent-handover-mode', m); } catch (e) {}
  }
  document.querySelectorAll('.hd-mode button').forEach(function (b) { b.addEventListener('click', function () { set(b.getAttribute('data-mode')); }); });
  set(window.__LU_MODE || 'dark');
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var pre = document.getElementById(b.getAttribute('data-copy')), text = pre.innerText, done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); };
      try { navigator.clipboard.writeText(text).then(done, function () { sel(pre); }); } catch (e) { sel(pre); }
    });
  });
  function sel(el) { var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
})();

