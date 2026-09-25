// Draws the app icon as standalone 1024x1024 SVGs, one per platform.
// F (the f-hole atom) ships; C (code and Run) and A (the Fiddle F) are kept as alternatives.
// Usage: node gen.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] ?? 'svg';
fs.mkdirSync(out, { recursive: true });

// Lucent palette
const C = {
  navyTop: '#33374f',
  navyBot: '#15161f',
  sheet: '#15161f',
  ink: '#eef1f8',
  inkMuted: '#aeb4c9',
  cyan: '#9feaf9',
  cyanMid: '#00a3bf',
  blue: '#1f7cff',
  fn: '#86b4ff',
  str: '#ffb38a',
  num: '#ff9a9a',
  // the original icon's orange
  orangeTop: '#f3ac4e',
  orange: '#e79537',
  orangeBot: '#d67a21',
};

// macOS continuous-corner squircle (superellipse approximation), 824px body.
function squircle(cx, cy, r, n = 5, steps = 256) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    const x = cx + r * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = cy + r * Math.sign(s) * Math.abs(s) ** (2 / n);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

const F_PATH =
  'M72,315.02442 L72,24 C72,10.745166 82.745166,0 96,0 L336,0 C349.254834,0 360,10.745166 360,24 C360,37.254834 349.254834,48 336,48 L120,48 L120,168 L219.428571,168 C230.789858,168 240,178.745166 240,192 C240,205.254834 230.789858,216 219.428571,216 L120,216 L120,315.02442 C161.405453,325.681447 192,363.267854 192,408 C192,461.019336 149.019336,504 96,504 C42.980664,504 0,461.019336 0,408 C0,363.267854 30.5945469,325.681447 72,315.02442 Z';

const defs = `
  <linearGradient id="navy" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.navyTop}"/><stop offset="1" stop-color="${C.navyBot}"/>
  </linearGradient>
  <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".35" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity=".12"/>
  </linearGradient>
  <linearGradient id="assist" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${C.blue}"/><stop offset=".45" stop-color="${C.cyanMid}"/><stop offset="1" stop-color="#6fd6ea"/>
  </linearGradient>
  <linearGradient id="assistV" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" stop-color="${C.blue}"/><stop offset=".5" stop-color="${C.cyanMid}"/><stop offset="1" stop-color="${C.cyan}"/>
  </linearGradient>
  <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfd7e6"/>
  </linearGradient>
  <linearGradient id="orange" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.orangeTop}"/><stop offset=".55" stop-color="${C.orange}"/><stop offset="1" stop-color="${C.orangeBot}"/>
  </linearGradient>
  <radialGradient id="sheen" cx=".32" cy=".22" r=".75">
    <stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="ink" x1="0" y1="130" x2="0" y2="900" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#fff1df"/>
  </linearGradient>
  <linearGradient id="nucleus" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f46a08"/><stop offset="1" stop-color="#d24f00"/>
  </linearGradient>
  <radialGradient id="glow">
    <stop offset="0" stop-color="${C.cyan}" stop-opacity=".55"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/>
  </radialGradient>
  <filter id="drop" x="-20%" y="-20%" width="140%" height="150%">
    <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#000" flood-opacity=".32"/>
  </filter>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="150%">
    <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#0b0c14" flood-opacity=".45"/>
  </filter>`;

// Containers per platform. `art` is drawn in a 1024 space and fitted to the body.
const MAC_BODY = squircle(512, 512, 412);
const containers = {
  // macOS: 824px squircle centred on the 1024 grid, with the system-style drop shadow.
  mac: (art, fill = 'url(#navy)') => `
  <g filter="url(#drop)"><path d="${MAC_BODY}" fill="${fill}"/></g>
  <clipPath id="body"><path d="${MAC_BODY}"/></clipPath>
  <g clip-path="url(#body)">${art}</g>
  <path d="${MAC_BODY}" fill="none" stroke="url(#rim)" stroke-width="6"/>`,
  // Linux (GNOME/freedesktop): an object on the 128 grid, 96 wide, with a darker base lip.
  linux: (art, fill = 'url(#navy)', lip = '#0c0d13') => `
  <rect x="128" y="136" width="768" height="768" rx="140" fill="${lip}"/>
  <rect x="128" y="112" width="768" height="760" rx="140" fill="${fill}"/>
  <clipPath id="body"><rect x="128" y="112" width="768" height="760" rx="140"/></clipPath>
  <g clip-path="url(#body)"><g transform="translate(512 492) scale(.93) translate(-512 -512)">${art}</g></g>
  <rect x="131" y="115" width="762" height="754" rx="137" fill="none" stroke="url(#rim)" stroke-width="6"/>`,
  // Windows, for F: the original's round disc, edge to edge.
  disc: (art, fill) => `
  <g filter="url(#drop)"><circle cx="512" cy="512" r="466" fill="${fill}"/></g>
  <clipPath id="body"><circle cx="512" cy="512" r="466"/></clipPath>
  <g clip-path="url(#body)">${art}</g>
  <circle cx="512" cy="512" r="463" fill="none" stroke="url(#rim)" stroke-width="6"/>`,
};

// --- Direction A: the Fiddle F, carried over, with a cyan Run dot ---
const fGlyph = (fill, dot) => `
  <path d="${F_PATH}" fill="${fill}"/>
  <circle cx="96" cy="408" r="48" fill="${dot}"/>`;
const A = {
  art: `
  <circle cx="434" cy="714" r="200" fill="url(#glow)"/>
  <g filter="url(#soft)" transform="translate(512 512) scale(1.22) translate(-160 -252)">${fGlyph('url(#paper)', C.cyan)}</g>`,
  // Windows 11: no plate. The glyph is the icon, in Lucent's assist gradient.
  win: `
  <g filter="url(#soft)" transform="translate(512 512) scale(1.72) translate(-186 -252)">
    <path d="${F_PATH}" fill="url(#assistV)"/>
    <path d="${F_PATH}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>
    <circle cx="96" cy="408" r="48" fill="${C.navyBot}"/>
  </g>`,
};

// --- Direction C: the code sheet and the Run capsule ---
const bar = (x, y, w, color, o = 1) =>
  `<rect x="${x}" y="${y}" width="${w}" height="36" rx="18" fill="${color}" fill-opacity="${o}"/>`;
// On Windows the sheet has no tile behind it, so it takes the navy glass and a brighter rim.
const sheet = (x, y, w, h, fill = C.sheet, rim = 0.12) => `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="44" fill="${fill}"/>
  <rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="41" fill="none" stroke="#fff" stroke-opacity="${rim}" stroke-width="6"/>
  ${bar(x + 60, y + 70, 110, C.cyan)}${bar(x + 190, y + 70, 190, C.fn)}
  ${bar(x + 110, y + 140, 150, C.inkMuted, 0.55)}${bar(x + 280, y + 140, 170, C.str)}
  ${bar(x + 110, y + 210, 90, C.num)}${bar(x + 220, y + 210, 130, C.inkMuted, 0.55)}
  ${bar(x + 60, y + 280, 60, C.inkMuted, 0.55)}`;
const capsule = (x, y) => `
  <g filter="url(#soft)">
    <rect x="${x}" y="${y}" width="300" height="150" rx="75" fill="${C.cyan}"/>
    <path d="M${x + 124} ${y + 42} L${x + 124} ${y + 108} Q${x + 124} ${y + 120} ${x + 135} ${y + 114} L${x + 190} ${y + 83} Q${x + 200} ${y + 75} ${x + 190} ${y + 67} L${x + 135} ${y + 36} Q${x + 124} ${y + 30} ${x + 124} ${y + 42} Z" fill="#0d2a31"/>
  </g>`;
// 32px and below: two thick code lines and a bigger Run capsule, so it stays legible.
const smallSheet = (x, y, w, h, fill = C.sheet, rim = 0) => `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="64" fill="${fill}"/>
  <rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 16}" rx="56" fill="none" stroke="#fff" stroke-opacity="${rim}" stroke-width="16"/>
  <rect x="${x + 70}" y="${y + 80}" width="${w * 0.62}" height="84" rx="42" fill="${C.cyan}"/>
  <rect x="${x + 70}" y="${y + 214}" width="${w * 0.4}" height="84" rx="42" fill="${C.str}"/>`;
const bigCapsule = (x, y) =>
  `<g transform="translate(${x} ${y}) scale(1.45) translate(${-x} ${-y})">${capsule(x, y)}</g>`;
const Cdir = {
  art: `${sheet(196, 214, 632, 470)}${capsule(472, 622)}`,
  win: `<g filter="url(#soft)">${sheet(92, 150, 840, 600, 'url(#navy)', 0.3)}</g>${capsule(590, 690)}`,
  small: `${smallSheet(180, 200, 664, 480)}${bigCapsule(420, 560)}`,
  winSmall: `${smallSheet(40, 110, 944, 640, 'url(#navy)', 0.3)}${bigCapsule(480, 610)}`,
};

// --- Direction F: the original orange disc, Electron's atom, and a violin f-hole as one of its arcs ---
// Three orbits on one ellipse (348 by 127 about the nucleus) at 28°, -32° and 90°, each drawn
// only in part, as open arcs. The f is one swept line, hairline at its eyes and heavy through the
// stem; its top eye is the upright orbit's electron and its bottom eye the -32° orbit's.
const NUC = [512, 522];
function arcPoints(rot, t0, t1, n = 120) {
  const r = (rot * Math.PI) / 180, cs = Math.cos(r), sn = Math.sin(r);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = (t0 + ((t1 - t0) * i) / n) * 2 * Math.PI;
    const x = 348 * Math.cos(t), y = 127 * Math.sin(t);
    return [NUC[0] + x * cs - y * sn, NUC[1] + x * sn + y * cs];
  });
}
const xy = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;
const cubic = (p0, p1, p2, p3) => (t) => {
  const m = 1 - t;
  return [0, 1].map((i) => m * m * m * p0[i] + 3 * m * m * t * p1[i] + 3 * m * t * t * p2[i] + t * t * t * p3[i]);
};
// The f: top hook, stem and bottom hook as one centreline, swept with a half-width that eases
// from `hair` at the eyes to `swell` in the stem, plus the two eyes and the two nicks at the waist.
function fHole({ nicks = true, hair = 12, swell = 32, eye = 0 } = {}) {
  const eyeTop = [538, 207], eyeBot = [205, 690], top = [442, 218], bot = [352, 692];
  const segs = [
    cubic(eyeTop, [542, 138], [446, 118], top),
    cubic(top, [428, 300], [382, 560], bot),
    cubic(bot, [336, 768], [228, 790], [197, 696]),
  ];
  const pts = segs.flatMap((f, k) => Array.from({ length: 81 }, (_, i) => ({ p: f(i / 80), t: i / 80, stem: k === 1 })).slice(k ? 1 : 0));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].p[0] - pts[i - 1].p[0], pts[i].p[1] - pts[i - 1].p[1]));
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const L = [], R = [];
  let waist = { d: 1 };
  pts.forEach(({ p, t, stem }, i) => {
    const u = cum[i] / cum[cum.length - 1];
    const half = hair + (swell - hair) * Math.min(ease((u - 0.06) / 0.26), ease((0.94 - u) / 0.28));
    const a = pts[Math.max(0, i - 1)].p, b = pts[Math.min(pts.length - 1, i + 1)].p;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
    L.push([p[0] - ty * half, p[1] + tx * half]);
    R.push([p[0] + ty * half, p[1] - tx * half]);
    if (stem && Math.abs(t - 0.525) < waist.d) waist = { p, tx, ty, d: Math.abs(t - 0.525) };
  });
  const nick = (side, along) => {
    const { p, tx, ty } = waist, c = [p[0] + tx * along, p[1] + ty * along];
    const q = (u, v) => xy([c[0] - ty * u + tx * v, c[1] + tx * u + ty * v]);
    return `M${q(side * (swell - 6), -16)}L${q(side * (swell + 22), side * 6)}L${q(side * (swell - 6), 16)}Z`;
  };
  return `<path d="M${L.map(xy).join('L')}L${R.reverse().map(xy).join('L')}Z" fill="url(#ink)"/>
    ${nicks ? `<path d="${nick(1, -26)}${nick(-1, 26)}" fill="url(#ink)"/>` : ''}
    <circle cx="${eyeTop[0]}" cy="${eyeTop[1]}" r="${47 + eye}" fill="url(#ink)"/>
    <circle cx="${eyeBot[0]}" cy="${eyeBot[1]}" r="${54 + eye}" fill="url(#ink)"/>`;
}
// `small` is for 32px and below: no hint dashes or nicks, everything heavier, and the mark a little larger.
function atomF({ small = false } = {}) {
  const w = small ? 46 : 28;
  const arc = (rot, t0, t1) =>
    `<path d="M${arcPoints(rot, t0, t1).map(xy).join('L')}" fill="none" stroke="url(#ink)" stroke-width="${w}" stroke-linecap="round"/>`;
  const dash = (rot, t0, t1) => (small ? '' : arc(rot, t0, t1));
  const [ex, ey] = arcPoints(28, 0.106, 0.106, 1)[0];
  const art = `
    ${arc(28, 0.322, 0.631)}${arc(28, 0.681, 0.813)}${arc(28, 0.852, 1.106)}${dash(28, 0.14, 0.156)}
    ${arc(-32, 0.805, 1.326)}${dash(-32, 0.58, 0.66)}
    ${arc(90, 0.8, 1.17)}${dash(90, 0.614, 0.64)}
    <circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="${small ? 60 : 52}" fill="url(#ink)"/>
    <circle cx="${NUC[0]}" cy="${NUC[1]}" r="${small ? 48 : 38}" fill="url(#nucleus)"/>
    ${small ? fHole({ nicks: false, hair: 19, swell: 42, eye: 8 }) : fHole()}`;
  // The mark sits at 80%, about the padding Apple's template and Electron's own icon use.
  const k = small ? 0.88 : 0.8;
  return `<rect width="1024" height="1024" fill="url(#sheen)"/><g transform="translate(512 512) scale(${k}) translate(-512 -512)">${art}</g>`;
}
const F_ART = atomF(), F_SMALL = atomF({ small: true });
const Fdir = {
  fill: 'url(#orange)',
  lip: '#9c4a10',
  art: F_ART,
  small: F_SMALL,
  win: containers.disc(F_ART, 'url(#orange)'),
  winSmall: containers.disc(F_SMALL, 'url(#orange)'),
};

const directions = { a: A, c: Cdir, f: Fdir };
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${defs}</defs>${body}</svg>\n`;

for (const [key, dir] of Object.entries(directions)) {
  fs.writeFileSync(path.join(out, `${key}-mac.svg`), svg(containers.mac(dir.art, dir.fill)));
  fs.writeFileSync(path.join(out, `${key}-linux.svg`), svg(containers.linux(dir.art, dir.fill, dir.lip)));
  fs.writeFileSync(path.join(out, `${key}-win.svg`), svg(dir.win));
  if (dir.small) fs.writeFileSync(path.join(out, `${key}-mac-small.svg`), svg(containers.mac(dir.small, dir.fill)));
  if (dir.winSmall) fs.writeFileSync(path.join(out, `${key}-win-small.svg`), svg(dir.winSmall));
}
console.log('wrote icons to', out);
