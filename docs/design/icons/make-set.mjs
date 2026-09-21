// Builds fiddle.icns, fiddle.ico, fiddle.png and fiddle.svg for one direction.
// Needs png/<dir>-{mac,win,linux}-1024.png (rendered by Chromium) and ImageMagick.
// Usage: node make-set.mjs <direction> <outDir>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [dir, outDir] = process.argv.slice(2);
const tmp = fs.mkdtempSync(path.join('png', `${dir}-`));
fs.mkdirSync(outDir, { recursive: true });

const resize = (src, size) => {
  const file = path.join(tmp, `${path.basename(src, '.png')}-${size}.png`);
  execFileSync('convert', [src, '-filter', 'Lanczos', '-resize', `${size}x${size}`, '-strip', file]);
  return file;
};

// macOS: every slot as PNG, so Finder and the Dock pick a sharp size.
// At 32px and below, a simplified drawing is used where the direction has one.
const pick = (plat, size) => {
  const small = `png/${dir}-${plat}-small-1024.png`;
  return size <= 32 && fs.existsSync(small) ? small : `png/${dir}-${plat}-1024.png`;
};
const mac = `png/${dir}-mac-1024.png`;
const slots = [
  ['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256],
  ['ic09', 512], ['ic10', 1024], ['ic11', 32], ['ic12', 64], ['ic13', 256], ['ic14', 512],
];
// ic11 and ic12 are the @2x slots for 16pt and 32pt, so they take the small drawing too.
const points = { ic11: 16, ic12: 32 };
const chunks = slots.map(([type, size]) => {
  const src = pick('mac', points[type] ?? size);
  const data = size === 1024 ? fs.readFileSync(mac) : fs.readFileSync(resize(src, size));
  const head = Buffer.alloc(8);
  head.write(type, 0, 'ascii');
  head.writeUInt32BE(data.length + 8, 4);
  return Buffer.concat([head, data]);
});
const body = Buffer.concat(chunks);
const head = Buffer.alloc(8);
head.write('icns', 0, 'ascii');
head.writeUInt32BE(body.length + 8, 4);
fs.writeFileSync(path.join(outDir, 'fiddle.icns'), Buffer.concat([head, body]));

// Windows: the sizes Explorer, the taskbar and the installer ask for.
const icoSizes = [16, 24, 32, 48, 64, 128, 256].map((s) => resize(pick('win', s), s));
execFileSync('convert', [...icoSizes, path.join(outDir, 'fiddle.ico')]);

// Linux: the 1024px PNG and the scalable SVG.
execFileSync('convert', [`png/${dir}-linux-1024.png`, '-strip', path.join(outDir, 'fiddle.png')]);
fs.copyFileSync(`svg/${dir}-linux.svg`, path.join(outDir, 'fiddle.svg'));

fs.rmSync(tmp, { recursive: true });
console.log('built', dir, 'into', outDir);
