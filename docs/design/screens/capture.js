// Captures the Lucent handover page into docs/design/screens/ at 2x.
// Needs Electron outside the repo (e.g. /tmp/lucent-render). Run one theme per process:
//   xvfb-run -a -s "-screen 0 3000x5400x24" electron --no-sandbox capture.js --themes=dark
//   xvfb-run -a -s "-screen 0 3000x5400x24" electron --no-sandbox capture.js --themes=light
// Uses webContents.capturePage + --force-device-scale-factor (CDP Page.captureScreenshot crashes
// under software GL). Computed-style dumps go to /tmp/lucent-render/meta.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const HTML = '/root/src/fiddle-2027/docs/design/lucent-handover.html';
const OUT = '/root/src/fiddle-2027/docs/design/screens';
const META = '/tmp/lucent-render/meta';
const THEMES = (process.argv.find(a => a.startsWith('--themes=')) || '--themes=dark,light').slice(9).split(',');
const WIDTH = 1440, HEIGHT = 2600, DPR = 2, MAX_SLICE = 2500;

app.setPath('userData', '/tmp/lucent-render/ud');
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor', String(DPR));
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(META, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const written = [];

async function run(theme) {
  const win = new BrowserWindow({ show: true, frame: false, x: 0, y: 0, useContentSize: true, width: WIDTH, height: HEIGHT, webPreferences: { backgroundThrottling: false } });
  const wc = win.webContents;
  wc.on('render-process-gone', (e, d) => console.log('RENDERER GONE', d));
  await win.loadFile(HTML);
  const js = code => wc.executeJavaScript(code, true);
  await js(`document.getElementById('mode-${theme}').click(); document.fonts.ready.then(() => document.fonts.size)`);
  // page chrome that is sticky or fixed would cover crops: make it static (outside the live specimens)
  await js(`[...document.querySelectorAll('body *')].forEach(el => { if (el.closest('#spec-window, #spec-gallery, #spec-run')) return;
    const p = getComputedStyle(el).position; if (p === 'sticky' || p === 'fixed') el.style.position = 'static'; }); 1`);
  console.log('viewport', await js('[innerWidth, innerHeight, devicePixelRatio, document.fonts.size, document.fonts.status]'));
  await sleep(1200);

  const settle = () => js(`document.getAnimations().forEach(a => { try { const t = a.effect && a.effect.getComputedTiming(); if (t && t.iterations !== Infinity) a.finish(); } catch (e) {} }); 1`);
  const rect = sel => js(`(() => { const el = typeof ${JSON.stringify(sel)} === 'string' ? document.querySelector(${JSON.stringify(sel)}) : null;
    if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; })()`);

  async function shot(name, r, pad = 0) {
    if (!r || r.w < 2 || r.h < 2) { console.log('SKIP', name, r); return; }
    const x = Math.max(0, r.x - pad), y = Math.max(0, r.y - pad);
    const w = Math.min(WIDTH - x, r.w + pad * 2), h = r.h + pad * 2;
    const slices = Math.ceil(h / MAX_SLICE);
    for (let i = 0; i < slices; i++) {
      const sy = y + i * MAX_SLICE, sh = Math.min(MAX_SLICE, h - i * MAX_SLICE);
      // scroll the slice into view so lazy/animated content is live
      await js(`window.scrollTo(0, ${Math.floor(sy)})`); await sleep(350); await settle(); await sleep(120);
      const scrollY = await js('scrollY');
      const img = await wc.capturePage({ x: Math.round(x), y: Math.round(sy - scrollY), width: Math.round(w), height: Math.round(sh) });
      const file = `${name}${slices > 1 ? '-part' + (i + 1) : ''}-${theme}.png`;
      if (img.isEmpty()) { console.log('EMPTY', file); continue; }
      fs.writeFileSync(path.join(OUT, file), img.toPNG());
      written.push(file);
      console.log('WROTE', file, Math.round(w), 'x', Math.round(sh));
    }
  }

  // fire a realistic press on an element (pointer + mouse + click)
  const press = sel => js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false;
    const o = { bubbles: true, cancelable: true, view: window, button: 0 };
    el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new MouseEvent('mousedown', o));
    el.dispatchEvent(new PointerEvent('pointerup', o)); el.dispatchEvent(new MouseEvent('mouseup', o));
    el.dispatchEvent(new MouseEvent('click', o)); return true; })()`);
  const union = (a, b) => { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }; };

  // ---------- page sections ----------
  const sections = [['top', 'overview'], ['principles', 'principles'], ['platform', 'platform'], ['color', 'colour'], ['type', 'type'],
    ['shape', 'shape'], ['depth', 'depth'], ['motion', 'motion'], ['layout', 'window-anatomy'], ['flows', 'flows'],
    ['a11y', 'accessibility'], ['checklist', 'checklist'], ['open', 'open-questions']];
  for (const [id, name] of sections) {
    if (id === 'top') { await shot('section-overview', await rect('#top'), 8); continue; }
    await shot('section-' + name, await rect('#' + id), 8);
  }
  // components section: tables only (the gallery is captured per group below)
  const comp = await rect('#components'), gal = await rect('#spec-gallery');
  await shot('section-components-tables', { x: comp.x, y: comp.y, w: comp.w, h: gal.y - comp.y }, 8);

  // ---------- component gallery, per group, chunked by card rows ----------
  const groups = await js(`[...document.querySelectorAll('#spec-gallery .hd-group')].map(g => {
    const r = g.getBoundingClientRect(), head = g.querySelector('h3').getBoundingClientRect();
    const cards = [...g.querySelectorAll('.pg-card')].map(c => { const q = c.getBoundingClientRect();
      return { name: c.dataset.c, x: q.left + scrollX, y: q.top + scrollY, w: q.width, h: q.height }; });
    return { name: g.querySelector('h3').firstChild.textContent.trim(), x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height,
      headY: head.top + scrollY, cards };
  })`);
  const index = [];
  for (const g of groups) {
    // rows = cards sharing a top edge
    const rows = [];
    for (const c of g.cards) { let row = rows.find(r => Math.abs(r.y - c.y) < 4); if (!row) rows.push(row = { y: c.y, cards: [] }); row.cards.push(c); }
    rows.sort((a, b) => a.y - b.y);
    rows.forEach(r => r.h = Math.max(...r.cards.map(c => c.h)));
    const chunks = []; let cur = null;
    for (const r of rows) {
      if (!cur || (r.y + r.h - cur.y) > 1500) { cur = { y: r.y, bottom: r.y + r.h, cards: [] }; chunks.push(cur); }
      cur.bottom = r.y + r.h; cur.cards.push(...r.cards.map(c => c.name));
    }
    const slug = g.name.toLowerCase().replace(/[^a-z]+/g, '-');
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i], top = i === 0 ? g.headY : c.y;
      const file = `components-${slug}${chunks.length > 1 ? '-' + (i + 1) : ''}`;
      await shot(file, { x: g.x, y: top, w: g.w, h: c.bottom - top }, 8);
      index.push({ file, group: g.name, cards: c.cards });
    }
  }
  fs.writeFileSync(path.join(META, 'gallery-index.json'), JSON.stringify(index, null, 1));

  // ---------- hero live specimen ----------
  const W = '#spec-window';
  await js(`document.querySelector('${W}').scrollIntoView({ block: 'center' })`); await sleep(400);
  await shot('hero-window-default', await rect(`${W} .pg-desk`));
  await shot('closeup-titlebar-default', await rect(`${W} .pg-win .fd-titlebar`), 6);
  await shot('closeup-sidebar-default', await rect(`${W} .pg-win-side`), 6);
  await shot('closeup-sheet-top-default', await js(`(() => { const r = document.querySelector('${W} .pg-win-main').getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: 180 }; })()`), 10);
  await shot('closeup-console-status-default', union(await rect(`${W} .fd-console`), await rect(`${W} .pg-status`)), 6);
  await dumpStyles('default');

  // version picker open
  await press(`${W} .fd-titlebar .fd-select-trigger`); await sleep(700);
  const pop = await rect(`${W} .fd-titlebar .fd-select-pop`) || await rect(`${W} .fd-menu`);
  await shot('hero-version-picker-open', await rect(`${W} .pg-desk`));
  if (pop) await shot('closeup-version-picker-open', union(await rect(`${W} .fd-titlebar .fd-cgroup`), pop), 16);
  await dumpStyles('picker');
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await press(`${W} .pg-edbody`); await sleep(500);

  // run -> busy -> running (error state)
  await press(`${W} .fd-run-btn`); await sleep(250);
  await shot('closeup-run-starting', await rect(`${W} .fd-titlebar .fd-cgroup`), 16);
  await sleep(1400);
  await shot('hero-window-running-error', await rect(`${W} .pg-desk`));
  await shot('closeup-titlebar-running', await rect(`${W} .pg-win .fd-titlebar`), 6);
  await shot('closeup-sidebar-running', await rect(`${W} .pg-win-side`), 6);
  await shot('closeup-tabrow-running', await rect(`${W} .pg-edhead`), 6);
  await shot('closeup-console-status-running', union(await rect(`${W} .fd-console`), await rect(`${W} .pg-status`)), 6);
  // open renderer.js so the error line and lens are visible
  await press(`${W} .fd-tab:nth-child(3)`); await sleep(500);
  await shot('hero-window-running-renderer', await rect(`${W} .pg-desk`));
  // the running fiddle's own window floats over the lens; hide it for this close-up only
  await js(`document.querySelector('${W} .pg-appwin').style.visibility = 'hidden'; 1`);
  await shot('closeup-error-lens', await js(`(() => { const e = document.querySelector('${W} .fd-editor'); const r = e.getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: Math.min(r.height, 260) }; })()`), 4);
  await js(`document.querySelector('${W} .pg-appwin').style.visibility = ''; 1`);
  await dumpStyles('running');

  // split editor (while running, so the diagnostics show in the second pane)
  await press(`${W} .pg-edhead button[aria-label="Split editor"]`); await sleep(700);
  await shot('hero-window-split-running', await rect(`${W} .pg-desk`));
  await shot('closeup-split-sheet', await rect(`${W} .pg-win-main`), 4);
  // stop, then show split idle
  await press(`${W} .fd-run-btn`); await sleep(600);
  await press(`${W} .fd-tab:nth-child(1)`); await sleep(500);
  await shot('hero-window-split', await rect(`${W} .pg-desk`));

  // run-state strip in Flows
  await shot('flows-run-states', await rect('#spec-run'), 8);

  async function dumpStyles(tag) {
    const data = await js(`(() => {
      const pick = ['background','backgroundImage','boxShadow','borderRadius','border','padding','height','width','font','color','letterSpacing','backdropFilter','cornerShape','gap'];
      const q = {
        sheet: '${W} .pg-win-main', win: '${W} .pg-win', winAfter: '${W} .pg-win', side: '${W} .pg-win-side',
        sideSel: '${W} .pg-win-side .fd-tree-item[aria-selected="true"]', sideRow: '${W} .pg-win-side .fd-tree-item:not([aria-selected="true"])',
        sideHead: '${W} .pg-win-side .fd-heading', sideField: '${W} .pg-win-side .fd-field', treeBadge: '${W} .fd-tree-badge',
        capsule: '${W} .fd-titlebar .fd-cgroup', selectTrigger: '${W} .fd-titlebar .fd-select-trigger', runBtn: '${W} .fd-run-btn',
        publish: '${W} .fd-titlebar-end .fd-btn:not(.fd-iconbtn)', gear: '${W} .fd-titlebar-end .fd-iconbtn', title: '${W} .fd-titlebar-title b', subtitle: '${W} .fd-titlebar-title span',
        tabs: '${W} .fd-tabs', tabSel: '${W} .fd-tab[aria-selected="true"]', tab: '${W} .fd-tab:not([aria-selected="true"])', tabErr: '${W} .fd-tab-err', tabDot: '${W} .fd-tab-dot',
        edhead: '${W} .pg-edhead', edproc: '${W} .pg-edproc', splitBtn: '${W} .pg-edhead .fd-iconbtn',
        editor: '${W} .fd-editor', lineNo: '${W} .fd-editor-no', errLine: '${W} .fd-editor-line[data-severity="error"]', lens: '${W} .fd-editor-lens',
        console: '${W} .fd-console', consoleBar: '${W} .fd-console-bar', consoleTitle: '${W} .fd-console-title', consoleLine: '${W} .fd-console-line',
        consoleErr: '${W} .fd-console-line[data-level="error"]', consoleTime: '${W} .fd-console-time', consoleProc: '${W} .fd-console-proc', consoleLink: '${W} .fd-console-line a, ${W} .fd-console-line button',
        status: '${W} .pg-status', statusLive: '${W} .pg-status .live', assist: '${W} .pg-assist', assistField: '${W} .pg-assist .fd-field',
        menu: '${W} .fd-menu', menuItem: '${W} .fd-menu-item', menuHead: '${W} .fd-menu-head', desk: '${W} .pg-desk'
      };
      const out = {};
      for (const [k, sel] of Object.entries(q)) {
        const el = document.querySelector(sel); if (!el) continue;
        const cs = getComputedStyle(el, k === 'winAfter' ? '::after' : (k === 'statusLive' ? null : null));
        const o = {}; pick.forEach(p => { const v = cs[p]; if (v && v !== 'none' && v !== 'normal' && v !== '0px' && v !== 'auto') o[p] = v; });
        if (k === 'statusLive') { const b = getComputedStyle(el, '::before'); o.before = { width: b.width, height: b.height, background: b.backgroundColor, boxShadow: b.boxShadow, borderRadius: b.borderRadius }; }
        const r = el.getBoundingClientRect(); o.rect = [Math.round(r.width*10)/10, Math.round(r.height*10)/10];
        out[k] = o;
      }
      return out; })()`);
    fs.writeFileSync(path.join(META, `styles-${tag}-${theme}.json`), JSON.stringify(data, null, 1));
  }

  win.destroy();
}

app.whenReady().then(async () => {
  try { for (const t of THEMES) await run(t); } catch (e) { console.error('FAILED', e); }
  fs.writeFileSync(path.join(META, 'written.json'), JSON.stringify(written, null, 1));
  app.quit();
});
