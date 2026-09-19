// Catalog helpers for `yarn generate` and the i18n tools. English is the source:
// `{ message, description, maxLength? }` per key. Other locales are flat i18next JSON
// (`key: message`); a plural is a group of `<key>_<category>` entries, per CLDR.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const appDir = path.resolve(import.meta.dirname, '..');
export const i18nDir = path.join(appDir, 'src/i18n');
export const localesDir = path.join(i18nDir, 'locales');
/** Translation state per locale: source hashes and reviewed flags (see i18n-translate.mjs). */
export const metaDir = path.join(i18nDir, 'translations');
export const glossaryFile = path.join(i18nDir, 'glossary.json');

/** Generated from English by `yarn generate`; never stored in locales/. */
export const pseudoLocales = ['en-XA', 'ar-XB'];

const CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];
export const PLURAL_KEY = /^(.+)_(zero|one|two|few|many|other)$/;

export function readJsonFile(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${path.relative(appDir, file)}: ${error.message}`, { cause: error });
  }
}

/** Writes pretty JSON. Returns whether the file changed. */
export function writeJsonFile(file, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return true;
}

export function namespacesOf(locale, dir = localesDir) {
  try {
    return fs
      .readdirSync(path.join(dir, locale))
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length))
      .sort();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

/** Every locale folder except English, sorted. Hidden folders are not locales. */
export function translatedLocales(dir = localesDir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && entry.name !== 'en' && !entry.name.startsWith('.'),
    )
    .map((entry) => entry.name)
    .sort();
}

/** `{ ns: { key: { message, description, maxLength? } } }` */
export function loadEnglish(dir = localesDir) {
  const catalog = {};
  for (const ns of namespacesOf('en', dir)) {
    catalog[ns] = readJsonFile(path.join(dir, 'en', `${ns}.json`));
  }
  return catalog;
}

/** `{ ns: { key: message } }` for every namespace file the locale has. */
export function loadMessages(locale, dir = localesDir) {
  const catalog = {};
  for (const ns of namespacesOf(locale, dir)) {
    catalog[ns] = readJsonFile(path.join(dir, locale, `${ns}.json`));
  }
  return catalog;
}

/** The CLDR plural categories of a locale, in canonical order. */
export function pluralCategories(locale) {
  const found = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
  return CATEGORIES.filter((category) => found.includes(category));
}

/**
 * Splits an English namespace into translation units: a plain key, or a plural
 * group (`errorCount_one` + `_other`) translated as a whole. A `_one` without an
 * `_other` stays a plain key; i18n-check reports it.
 */
export function unitsOf(entries) {
  const units = [];
  const groups = new Map();
  for (const [key, entry] of Object.entries(entries)) {
    const match = PLURAL_KEY.exec(key);
    if (match && Object.hasOwn(entries, `${match[1]}_other`)) {
      let unit = groups.get(match[1]);
      if (!unit) {
        unit = { key: match[1], plural: true, forms: {}, description: entry.description };
        groups.set(match[1], unit);
        units.push(unit);
      }
      unit.forms[match[2]] = entry.message;
      if (typeof entry.maxLength === 'number')
        unit.maxLength = Math.min(unit.maxLength ?? Infinity, entry.maxLength);
    } else {
      units.push({
        key,
        plural: false,
        message: entry.message,
        description: entry.description,
        maxLength: entry.maxLength,
      });
    }
  }
  return units;
}

/** The plural categories a unit has in `locale` (empty for plain keys). */
export function categoriesFor(unit, locale) {
  if (!unit.plural) return [];
  const categories = pluralCategories(locale);
  // i18next honours an explicit `_zero` in any language, so keep English's.
  if ('zero' in unit.forms && !categories.includes('zero')) categories.unshift('zero');
  return categories;
}

/** The flat keys a unit has in `locale`. */
export function keysFor(unit, locale) {
  return unit.plural
    ? categoriesFor(unit, locale).map((category) => `${unit.key}_${category}`)
    : [unit.key];
}

/** The English text a form is translated from; a category English lacks uses `other`. */
export function sourceText(unit, category) {
  return unit.plural ? (unit.forms[category] ?? unit.forms.other) : unit.message;
}

/** English forms in canonical order. */
function englishForms(unit) {
  return Object.fromEntries(
    CATEGORIES.filter((category) => category in unit.forms).map((c) => [
      c,
      unit.forms[c],
    ]),
  );
}

/** A unit's translation in `messages`: a string, `{ category: text }`, or undefined if incomplete. */
export function readUnit(unit, locale, messages = {}) {
  if (!unit.plural) {
    return typeof messages[unit.key] === 'string' ? messages[unit.key] : undefined;
  }
  const forms = {};
  for (const category of categoriesFor(unit, locale)) {
    const text = messages[`${unit.key}_${category}`];
    if (typeof text !== 'string') return undefined;
    forms[category] = text;
  }
  return forms;
}

export function writeUnit(unit, locale, messages, value) {
  if (!unit.plural) messages[unit.key] = value;
  else
    for (const category of categoriesFor(unit, locale))
      messages[`${unit.key}_${category}`] = value[category];
}

export function hashText(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

/** Hash of a translation value (string or forms), stable across key order. */
export function hashValue(value) {
  if (typeof value === 'string') return hashText(value);
  const ordered = CATEGORIES.filter((c) => c in value).map((c) => [c, value[c]]);
  return hashText(JSON.stringify(ordered));
}

/** Hash of a unit's English text: when it changes, translations are out of date. */
export function sourceHash(unit) {
  return hashValue(unit.plural ? englishForms(unit) : unit.message);
}

const PLACEHOLDER = /\{\{\s*([^},\s]+)[^}]*\}\}|\$t\(([^)]*)\)/g;
const TAG = /<\/?\s*([A-Za-z][A-Za-z0-9]*|\d+)\s*\/?>/g;

/** `{{name}}` placeholders (formats dropped) and `$t(...)` references, sorted and unique. */
export function placeholdersOf(text) {
  const found = new Set();
  for (const match of text.matchAll(PLACEHOLDER)) {
    found.add(match[1] !== undefined ? `{{${match[1]}}}` : `$t(${match[2].trim()})`);
  }
  return [...found].sort();
}

/** Tags such as `<0>`, `</0>`, `<strong>` or `<br/>`, sorted (a multiset). */
export function tagsOf(text) {
  return [...text.matchAll(TAG)].map((match) => match[0].replace(/\s+/g, '')).sort();
}

/** Length as people see it: an interpolation renders as a few characters. */
export function visibleLength(text) {
  return text.replace(/\{\{[^}]*\}\}/g, 'xxx').length;
}

/**
 * Problems with `value` as the translation of `unit` into `locale`: plural
 * forms, placeholders, tags, empty text and maxLength.
 */
export function validateUnit(unit, locale, value, { checkLength = true } = {}) {
  const problems = [];
  let entries;
  if (unit.plural) {
    if (!value || typeof value !== 'object') return ['expected plural forms'];
    const wanted = categoriesFor(unit, locale);
    for (const category of wanted) {
      if (typeof value[category] !== 'string')
        problems.push(`missing plural form "${category}"`);
    }
    for (const category of Object.keys(value)) {
      if (!wanted.includes(category)) {
        problems.push(
          `invalid plural form "${category}" (${locale} uses ${wanted.join(', ')})`,
        );
      }
    }
    entries = wanted
      .filter((c) => typeof value[c] === 'string')
      .map((c) => [c, value[c]]);
  } else {
    if (typeof value !== 'string') return ['expected a string'];
    entries = [[undefined, value]];
  }

  // A plural form may drop {{count}} ("one file"), but never anything else.
  const english = unit.plural ? Object.values(unit.forms).join('\n') : unit.message;
  const known = placeholdersOf(english);
  const required = known.filter((p) => !(unit.plural && p === '{{count}}'));
  for (const [category, text] of entries) {
    const where = category ? ` (${category})` : '';
    if (!text.trim()) {
      problems.push(`empty translation${where}`);
      continue;
    }
    const have = placeholdersOf(text);
    const unknown = have.filter((p) => !known.includes(p));
    const missing = required.filter((p) => !have.includes(p));
    if (unknown.length)
      problems.push(`unknown placeholder ${unknown.join(', ')}${where}`);
    if (missing.length)
      problems.push(`missing placeholder ${missing.join(', ')}${where}`);
    const wantTags = tagsOf(sourceText(unit, category)).join(' ');
    const haveTags = tagsOf(text).join(' ');
    if (wantTags !== haveTags) {
      problems.push(`tags differ from English${where}: "${haveTags}" vs "${wantTags}"`);
    }
    if (
      checkLength &&
      typeof unit.maxLength === 'number' &&
      visibleLength(text) > unit.maxLength
    ) {
      problems.push(`longer than maxLength ${unit.maxLength}${where}`);
    }
  }
  return problems;
}

// Pseudo-locales, as Chromium and Android define them.
const ACCENTS = {
  a: 'á',
  b: 'ƀ',
  c: 'ç',
  d: 'ð',
  e: 'é',
  f: 'ƒ',
  g: 'ĝ',
  h: 'ĥ',
  i: 'î',
  j: 'ĵ',
  k: 'ķ',
  l: 'ļ',
  m: 'ɱ',
  n: 'ñ',
  o: 'ö',
  p: 'þ',
  q: 'ǫ',
  r: 'ŕ',
  s: 'š',
  t: 'ţ',
  u: 'û',
  v: 'ṽ',
  w: 'ŵ',
  x: 'ẋ',
  y: 'ý',
  z: 'ž',
  A: 'Å',
  B: 'Ɓ',
  C: 'Ç',
  D: 'Ð',
  E: 'É',
  F: 'Ƒ',
  G: 'Ĝ',
  H: 'Ĥ',
  I: 'Î',
  J: 'Ĵ',
  K: 'Ķ',
  L: 'Ļ',
  M: 'Ṁ',
  N: 'Ñ',
  O: 'Ö',
  P: 'Þ',
  Q: 'Ǫ',
  R: 'Ŕ',
  S: 'Š',
  T: 'Ţ',
  U: 'Û',
  V: 'Ṽ',
  W: 'Ŵ',
  X: 'Ẋ',
  Y: 'Ý',
  Z: 'Ž',
};
const PADDING = 'one two three four five six seven eight nine ten'.split(' ');
// Placeholders, $t() references and tags pass through untouched.
const PROTECTED = /(\{\{[^}]*\}\}|\$t\([^)]*\)|<[^>]+>)/;

/**
 * `en-XA`: accented, about 40% longer, in brackets, so hard-coded strings and
 * clipped layouts stand out. `ar-XB`: every word forced right-to-left (RLO…PDF
 * inside RLMs), so the text reads mirrored and the app runs with `dir="rtl"`.
 */
export function pseudoLocalize(locale, text) {
  const parts = text.split(PROTECTED);
  const mapText = (fn) => parts.map((part, i) => (i % 2 ? part : fn(part))).join('');
  if (locale === 'en-XA') {
    const accented = mapText((part) => part.replace(/[A-Za-z]/g, (c) => ACCENTS[c]));
    const target = Math.ceil(visibleLength(text) * 0.4);
    let pad = '';
    for (let i = 0; pad.length < target; i++) pad += ` ${PADDING[i % PADDING.length]}`;
    return `[${accented}${pad}]`;
  }
  if (locale === 'ar-XB') {
    return mapText((part) =>
      part.replace(/\S+/g, (word) => `\u200F\u202E${word}\u202C\u200F`),
    );
  }
  throw new Error(`unknown pseudo-locale ${locale}`);
}

/** A pseudo-locale's flat messages for one English namespace. */
export function pseudoMessages(locale, entries) {
  const messages = {};
  for (const unit of unitsOf(entries)) {
    if (!unit.plural) messages[unit.key] = pseudoLocalize(locale, unit.message);
    else {
      for (const category of categoriesFor(unit, locale)) {
        messages[`${unit.key}_${category}`] = pseudoLocalize(
          locale,
          sourceText(unit, category),
        );
      }
    }
  }
  return messages;
}
