# Lucent: implementer brief

A visual companion to `lucent-handover.html`. Every PNG in `screens/` comes from the live
handover page at 2x (`deviceScaleFactor` 2) in both appearances. Where a screenshot and a
handover table disagree, the table wins.

**Read this first.** `prototype/styles.css` is only the neutral base layer. It has no Lucent
rules. All 334 Lucent overrides (`[data-theme^="electron"] …`) and the `--lu-*` prototype
variables (`--lu-cap`, `--lu-chip`, `--lu-lift`, `--lu-rim`, …) are in the inline `<style>` of
`lucent-handover.html`. For the prototype's exact CSS, read that `<style>` block, not
`styles.css`. For shipping values, use `lucent-tokens.css`.

## 1. Screenshot index (`screens/`)

Each name exists as `<name>-dark.png` and `<name>-light.png` (104 files).

**Live main window (hero specimen), 1032 × 788 CSS px, painted backdrop included**
| File | State |
|---|---|
| `hero-window-default` | Idle: main.js tab, one editor, console "Ready…", status "Ready" |
| `hero-version-picker-open` | Version select in the title-bar capsule, open |
| `hero-window-running-error` | After pressing Run: Stop state, tab badge "1", sidebar "1 error", red console row, Running pills. The small glass "Hello World!" window is the running fiddle |
| `hero-window-running-renderer` | Same, with renderer.js selected: error line and error lens |
| `hero-window-split` | Split editor, idle (main.js left, renderer.js right) |
| `hero-window-split-running` | Split editor while running (lens in the left pane) |

**Close-ups of the hero window**
| File | Shows |
|---|---|
| `closeup-titlebar-default` / `-running` | 56px title bar: lights, sidebar toggle, title, capsule (select + Run/Stop), Publish, Settings |
| `closeup-run-starting` | Capsule with Run in the "Starting" (busy) state |
| `closeup-version-picker-open` | Capsule plus open version menu |
| `closeup-sidebar-default` / `-running` | Sidebar on glass: heads, selected chip, "1 error" pill, package field |
| `closeup-sheet-top-default` | Top of the sheet: corner radius, top rim, tab row, hairline |
| `closeup-tabrow-running` | Tab row with the error badge and unsaved dot |
| `closeup-error-lens` | Error line, squiggle and lens (the fiddle window is hidden for this shot) |
| `closeup-console-status-default` / `-running` | Console header and rows, plus the status bar |
| `closeup-split-sheet` | Whole sheet in split view, with pane headers |
| `flows-run-states` | The four Run states (Ready, Downloading, Starting, Running) from the Flows section |

**Handover sections** (tall ones split into `-part1`/`-part2`)
`section-overview`, `section-principles`, `section-platform` (glass on real windows),
`section-colour-part1/2`, `section-type`, `section-shape`, `section-depth`, `section-motion`,
`section-window-anatomy`, `section-flows`, `section-components-tables-part1/2` (resolved-values
table and states), `section-accessibility`, `section-checklist`, `section-open-questions`.

**Component gallery (all 60 live specimens, in page order)**
| File | Components |
|---|---|
| `components-layout-1` | TitleBar, SplitPane, Tile, ControlGroup, Fieldset |
| `components-layout-2` | Page, Divider, ScrollArea |
| `components-typography` | Heading, Text, Code, Link |
| `components-actions` | Button, IconButton, RunButton, SplitButton |
| `components-inputs-1` | Input, Select (open), Checkbox, Switch |
| `components-inputs-2` | SegmentedControl, UrlInput, InputList, RadioGroup, FilePicker, CompactSelect |
| `components-inputs-3` | FormField |
| `components-selection` | FilterableSelect (open), Suggest, ContextMenu (open) |
| `components-navigation` | Menu, Tabs, FileTree, SideNav |
| `components-overlays-1` | Dialog, AlertDialog, Popover |
| `components-overlays-2` | ToastStack, Coachmark |
| `components-feedback-1` | Badge, Tooltip, Progress, Toast, Spinner, LoadingBlock |
| `components-feedback-2` | Callout, EmptyState |
| `components-data` | Table, StatusCell, Tag, ListRow, Card |
| `components-app-1` | CodeEditor, EditorGrid, Console |
| `components-app-2` | VersionPicker (open), ModuleList, VersionManager |
| `components-foundations` | Kbd, Icon (the full icon grid) |

Regenerate with `screens/capture.js`; its header comment has the command. The handover page
switches appearance through `body[data-theme="electron-dark|electron-light"]`, set by the
`#mode-dark` / `#mode-light` buttons (saved in `localStorage['lucent-handover-mode']`).

## 2. Prototype components (`@ds-bundle`, namespace `Fiddle`)

Grouped as the page groups them. There are 60 in all.

- **Layout (8):** TitleBar, SplitPane, Tile, ControlGroup, Fieldset, Page, Divider, ScrollArea
- **Typography (4):** Heading, Text, Code, Link
- **Actions (4):** Button, RunButton, SplitButton, IconButton
- **Inputs (11):** Input, UrlInput, InputList, Checkbox, RadioGroup, Switch, SegmentedControl,
  FilePicker, CompactSelect, FormField, Select
- **Selection (3):** FilterableSelect, Suggest, ContextMenu
- **Navigation (4):** Menu, Tabs, FileTree, SideNav
- **Overlays (5):** Dialog, AlertDialog, Popover, ToastStack, Coachmark
- **Feedback (8):** Badge, Tooltip, Toast, Spinner, LoadingBlock, Progress, Callout, EmptyState
- **Data (5):** Table, StatusCell, Tag, ListRow, Card
- **App (6):** CodeEditor, EditorGrid, Console, VersionPicker, ModuleList, VersionManager
- **Foundations (2):** Kbd, Icon

Live-window composition (`AppWindow` in `prototype/specimens.js`): TitleBar(start: IconButton
`sidebar`; center: ControlGroup[Select 180px, RunButton]; end: Button `upload` "Publish",
IconButton `gear`). The sidebar is Heading level 4 plus FileTree per process, then an Input sm
"Add a package". The sheet holds Tabs, the process label and IconButton `columns` (sm), then
CodeEditor or EditorGrid, then the assist row (Input sm `sparkle` + Button sm "Suggest" ⌘↵),
then Console at 160. The status bar sits below.

## 3. Easy-to-miss visual details

Values come from computed styles in the live page (dark / light).

**Glass and rims**
- App-drawn glass has two inset 0.5px rims together: `inset 0 .5px 0 var(--rim)` (top, 0.30 /
  0.95 white) plus `inset 0 0 0 .5px var(--rim-soft)` (all round, 0.07 / 0.34). Menus,
  popovers, toasts, dialogs and coachmarks all have them on top of `shadow-popover`.
- The prototype window frame draws its lit edge as a 1px masked ring (`::after`, `padding:1px`,
  mask-composite exclude). It combines a radial `--rim` highlight centred at 16% −8%
  (top-left brightest) with a vertical `--rim-soft` gradient that fades by 26% and returns at
  the bottom. In the app the OS draws the window edge. Only copy this for app-drawn floating
  panes.
- A menu opened inside the window is 97% opaque `surface-raised`, not 90%. This is glass on
  glass: Chromium can't blur through the chrome's backdrop filter.

**The sheet**
- Radius 26 (squircle) and `shadow-island`. In **dark only** it adds a top rim,
  `inset 0 .5px 0 rgba(255,255,255,.08)`. Light has no rim. No border.
- It sits 8px from the right window edge and directly against the sidebar column (no gap on
  the left). Its top is flush under the 56px title bar and its bottom is above the 32px status
  bar. `overflow:hidden` clips the console to the bottom corners.
- The hairlines under the tab row, above the console and above the assist row are 0.5px
  `--line`. In dark that line is cyan-tinted (`rgba(159,234,249,.12)`), not grey.

**Title bar and capsules**
- The toolbar capsule is one pill: `--capsule` fill (white 8% / 60%), 3px inset, 2px gap,
  `shadow-capsule` (inset top highlight, inset 0.5 rim, 0.5 dark outer ring, 3/10/−3 drop).
  Its Select trigger is transparent with a round (not squircle) 999 radius, padding
  0 10 0 14, value weight 500, and `--fill` on hover or open.
- Publish, Settings and the sidebar toggle are **separate 36px capsules** with the same
  capsule fill and shadow. They are not secondary buttons. Publish padding is 0 16 0 14.
- Title "window-vibrancy" is 13px 650 with −0.01em tracking. "Edited" is 12px 400 ink-muted.
- The version menu opens **10px below the capsule, left-aligned to its outer edge (−3px)**.

**Run button**
- The sheen is `linear-gradient(180deg, rgba(255,255,255,.2), transparent 55%)` over
  `--action`. On top of that: `inset 0 .5px 0 rgba(255,255,255,.5)` (top lip),
  `inset 0 -.5px 0 rgba(0,0,0,.12)` (bottom lip), and two shadows tinted from the action colour
  (35% at 0 1px 2px, 60% at 0 4px 12px −4px). That gives a cyan glow in dark and a navy one in
  light.
- Hover takes the sheen to 28%→4%. Pressed drops the sheen and mixes action 14% toward black.
- Inside the capsule, Run is a 30px pill with padding 0 14 0 12 and min-width 108 (150 while
  downloading). The ⌘R hint is Inter 12px (**not mono**), tracking .02em, at 80% opacity.
- In light, Run is **navy with a cyan label**.
- The Stop state has no border. It uses `spark-soft` fill with `inset 0 0 0 .5px` spark at 30%.
  The label and stop square stay **ink, not red**.

**Tabs**
- The selected tab uses `--hover` fill: cyan 8% in dark, navy 6% in light. There is no
  underline or marker. 28px tall, radius 12 (squircle), padding 0 11, 12.5/16 500, 2px apart.
  Inactive tabs are ink-muted, and hover is 55% of hover.
- The order after the label is: error count, then the unsaved dot. The count is a 16px capsule,
  min-width 17, Inter 10px 600, spark on spark-soft. The dot is 6px. The close ✕ is hidden on a
  dirty tab until hover.
- The process label ("Main process") sits at the right of the tab row, 11.5/14 500 ink-faint.
  The split IconButton is 24×24, radius 8, and pressed while split.

**Sidebar**
- Unselected rows have **ink** labels (not muted) with ink-muted file icons. Hover uses
  `--capsule` fill.
- The selected row is a "chip": `--chip` fill (white 13% / 88%) plus `--lift`. The dark lift
  includes its own top highlight `inset 0 .5px 0 rgba(255,255,255,.14)` and a 0.5px black ring.
  The label goes to weight 500 and the file icon **turns accent**. Radius 12, height 28, padding
  0 8, icon gap 6.
- Heads are caption 11/14 600 ink-muted in sentence case, padding 14 8 5 (4 on top for the
  first).
- The "1 error" pill is 16px tall, Inter 10.5px 600, padding 0 6, spark on spark-soft. It is
  right-aligned and **before** the unsaved dot.
- The package field is 24px tall, radius 15, `field-on-glass` fill with a 1px
  `field-edge-on-glass` border.

**Editor**
- The gutter is 66px: 48px numbers plus 18px padding. Numbers are ink-faint. The cursor-line
  number is ink, and the cursor line is accent 7% mixed into surface.
- The error line is a full-width spark-soft band with a spark number, plus a **wavy spark
  underline** under the offending token (`api`).
- The error lens has margin 6 16 8 66 (it starts at the code column), padding 9 12, radius 15.
  Its fill is spark 6% into surface with `inset 0 0 0 .5px` spark at 30%. It shows an
  alert-triangle icon in spark, then "TypeError" 600 spark, then the message in ink. The hint
  sits on its own line in ink-muted, at 12.5/18.

**Console**
- Background is surface-sunken with a single `inset 0 .5px 0 var(--line)` on top.
- The 46px bar holds "Console" (12.5/16 600), then a SegmentedControl (All / Main / Renderer),
  then a "Filter output" field. The right side has a "Running" badge (spark, with dot) and
  popout and trash icon buttons.
- **Rows are inset, rounded pills**: margin 0 8, padding 2 8, radius 8, grid 60 / 70 / 1fr,
  12px gap. The time is Commit Mono 12/18 ink-faint. The **process column is Inter 11/18 500**
  (600 on error rows). The message is mono. System rows are ink-faint and warn rows use
  warning.
- An error row is a spark-soft pill with **all three columns in spark**. The location
  "(renderer.js:4:36)" keeps the **accent colour with an underline**; it is not red.

**Status bar**
- On the glass, 32px tall, padding 0 20 0 22, 18px gaps, 11.5/14 500 ink-muted. The right side
  shows "Ln 8, Col 5" and the language.
- "Running" is a capsule: padding 2 9 2 8, **margin-left −9px** so its text lines up with
  "Ready". It is 600 spark on spark-soft, with a 6px dot and a **2.5px halo of spark at 22%**.

**Assist row**
- The field's 1px gradient border is two backgrounds:
  `linear-gradient(field,field) padding-box, <assist-ring> border-box` on a transparent
  border.
- Focus adds a three-colour glow. The icon is `sparkle`. "Suggest" is a secondary sm capsule
  showing ⌘↵.

**Controls in the gallery**
- The secondary button has no border: `0 0 0 .5px button-edge`, `0 1px 2px`, and an inset
  0.5px top highlight (white 12% / 70%). Danger is spark at 9% with spark text and no border.
- A checked checkbox uses the same sheen as Run over action, with an inset 0.5px top at 40%.
  The tick is drawn at stroke 2, 12px.
- The switch track is off at line-strong 80% with a faint inset shadow. The knob is white with
  a 3-layer shadow and widens 4px while pressed.
- Kbd keys are **Inter, not mono**, 11px 500. They have a `0 0 0 .5px line-strong` ring and a
  1px bottom lip (`0 1px 0 .5px` line-strong 60%).
- Focus is a 3px outline in accent at 70%, offset 1px (−3px inside tab rows and lists). A
  field's focus is an accent border plus a 3.5px ring of accent at 26%.
- `corner-shape: squircle` is on every button, field, menu, item and dialog. Capsules
  explicitly reset to `corner-shape: round`.

**Split view** (`closeup-split-sheet`)
- The tab row keeps driving the left pane. Its process label disappears.
- Each pane gets a header: grip dots, filename, process label, then popout, maximize and close.
  An errored pane shows an alert icon and a spark filename with "1 error".
- The panes are separated by a 0.5px `--line`.

## 4. Icons

Source: `prototype/components-bundle.js`. The `PATHS` object is at **lines 84–137**, one entry
per icon, as React SVG children. The `Icon()` renderer is at **lines 138–157**, and
`ICONS = Object.keys(PATHS)`.

- Every icon uses `viewBox="0 0 16 16"`, `fill="none"`, `stroke="currentColor"`,
  **`stroke-linecap="round"`, `stroke-linejoin="round"`**. Sizes: sm 12, md 16, lg 20.
- Stroke width: the bundle default is 1.5, but Lucent overrides it to **1.4**
  (`[data-theme^="electron"] .fd-icon { stroke-width: 1.4 }`), which matches the handover
  tables. The Icon card caption still says 1.5. Use 1.4.
- The strokes are simple geometric outlines: rects with rx 1.5, straight segments and small
  arcs. The only filled shapes are `play` (triangle), `stop` (rect rx 1) and the r≈0.9 dots in
  `more`, `grip` and `palette`.
- The 52 names, in grid order (`components-foundations-*.png`): play, stop, terminal, file,
  folder, chevron-down, chevron-right, upload, download, plus, search, link, check, minus, x,
  gear, lock, info, alert, check-circle, copy, trash, refresh, package, maximize, minimize,
  popout, dock, pin, more, eye, eye-off, sidebar, columns, branch, book, external, filter, grip,
  user, palette, keyboard, history, cloud, bell, sparkle, window, code, arrow-right,
  arrow-left, circle, x-circle.
- Where the window uses them: `sidebar` (title bar toggle), `play`/`stop` (Run), `upload`
  (Publish), `gear` (Settings), `file` (tree rows), `search` (package and filter fields),
  `columns` (split), `sparkle` (assist), `alert` (error lens, pane header), `grip`, `popout`,
  `maximize` and `x` (pane headers), `external`/`popout` and `trash` (console bar),
  `chevron-down` (select), `check` (selected menu item).
