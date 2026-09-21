// Draws the app icon as standalone 1024x1024 SVGs, one per platform.
// C (code and Run) ships; A (the Fiddle F) is kept as the alternative.
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
  mac: (art) => `
  <g filter="url(#drop)"><path d="${MAC_BODY}" fill="url(#navy)"/></g>
  <clipPath id="body"><path d="${MAC_BODY}"/></clipPath>
  <g clip-path="url(#body)">${art}</g>
  <path d="${MAC_BODY}" fill="none" stroke="url(#rim)" stroke-width="6"/>`,
  // Linux (GNOME/freedesktop): an object on the 128 grid, 96 wide, with a darker base lip.
  linux: (art) => `
  <rect x="128" y="136" width="768" height="768" rx="140" fill="#0c0d13"/>
  <rect x="128" y="112" width="768" height="760" rx="140" fill="url(#navy)"/>
  <clipPath id="body"><rect x="128" y="112" width="768" height="760" rx="140"/></clipPath>
  <g clip-path="url(#body)"><g transform="translate(512 492) scale(.93) translate(-512 -512)">${art}</g></g>
  <rect x="131" y="115" width="762" height="754" rx="137" fill="none" stroke="url(#rim)" stroke-width="6"/>`,
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

const directions = { a: A, c: Cdir };
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${defs}</defs>${body}</svg>\n`;

for (const [key, dir] of Object.entries(directions)) {
  fs.writeFileSync(path.join(out, `${key}-mac.svg`), svg(containers.mac(dir.art)));
  fs.writeFileSync(path.join(out, `${key}-linux.svg`), svg(containers.linux(dir.art)));
  fs.writeFileSync(path.join(out, `${key}-win.svg`), svg(dir.win));
  if (dir.small) fs.writeFileSync(path.join(out, `${key}-mac-small.svg`), svg(containers.mac(dir.small)));
  if (dir.winSmall) fs.writeFileSync(path.join(out, `${key}-win-small.svg`), svg(dir.winSmall));
}
console.log('wrote icons to', out);
