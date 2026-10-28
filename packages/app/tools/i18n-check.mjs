#!/usr/bin/env node
// `yarn i18n:check`: missing or extra keys, placeholder, tag and plural mismatches,
// translations over maxLength, and English keys no source file seems to use (a
// heuristic: a key counts as used if it appears as a string literal or matches a
// template literal). Warns about translations whose English has changed since.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  appDir,
  keysFor,
  loadEnglish,
  loadMessages,
  metaDir,
  PLURAL_KEY,
  pluralCategories,
  pseudoLocales,
  readJsonFile,
  readUnit,
  sourceHash,
  translatedLocales,
  unitsOf,
  validateUnit,
} from './i18n-shared.mjs';

/** Problems in the English catalog itself: plural groups and their forms. */
export function checkEnglish(english) {
  const errors = [];
  const allowed = new Set([...pluralCategories('en'), 'zero']);
  for (const [ns, entries] of Object.entries(english)) {
    for (const key of Object.keys(entries)) {
      const match = PLURAL_KEY.exec(key);
      if (!match) continue;
      if (!Object.hasOwn(entries, `${match[1]}_other`)) {
        errors.push(`en/${ns}.json: ${key}: plural key without ${match[1]}_other`);
      } else if (!allowed.has(match[2])) {
        errors.push(
          `en/${ns}.json: ${key}: invalid plural form for English (use one, other or zero)`,
        );
      }
    }
  }
  return errors;
}

/** Errors and warnings for one translated locale. */
export function checkLocale(english, locale, messages, meta = {}) {
  const errors = [];
  const warnings = [];
  for (const ns of Object.keys(messages)) {
    if (!(ns in english))
      errors.push(`${locale}/${ns}.json: no English source; remove it`);
  }
  for (const [ns, entries] of Object.entries(english)) {
    const where = `${locale}/${ns}.json`;
    const current = messages[ns] ?? {};
    const allowed = new Set();
    const pluralBases = new Set();
    for (const unit of unitsOf(entries)) {
      const keys = keysFor(unit, locale);
      for (const key of keys) allowed.add(key);
      if (unit.plural) pluralBases.add(unit.key);
      const missing = keys.filter((key) => typeof current[key] !== 'string');
      if (missing.length) {
        errors.push(`${where}: missing ${missing.join(', ')}`);
        continue;
      }
      for (const problem of validateUnit(unit, locale, readUnit(unit, locale, current))) {
        errors.push(`${where}: ${unit.key}: ${problem}`);
      }
      const recorded = meta[`${ns}:${unit.key}`];
      if (recorded !== undefined && recorded !== sourceHash(unit)) {
        warnings.push(
          `${where}: ${unit.key}: English changed since it was translated; run \`yarn i18n:translate\``,
        );
      }
    }
    for (const key of Object.keys(current)) {
      if (allowed.has(key)) continue;
      const match = PLURAL_KEY.exec(key);
      if (match && pluralBases.has(match[1])) {
        errors.push(
          `${where}: ${key}: invalid plural form (${locale} uses ${pluralCategories(locale).join(', ')})`,
        );
      } else errors.push(`${where}: ${key}: unused (English has no such key)`);
    }
  }
  return { errors, warnings };
}

/** The non-test .ts/.tsx files under `dir`, outside generated/ and locales/. */
function sourceFiles(dir) {
  return fs
    .readdirSync(dir, { recursive: true })
    .filter((rel) => /\.tsx?$/.test(rel) && !/\.test\.tsx?$/.test(rel))
    .filter(
      (rel) => !rel.split(path.sep).some((p) => p === 'generated' || p === 'locales'),
    )
    .map((rel) => path.join(dir, rel));
}

/** English keys (plural groups by their base key) that no source text seems to use. */
export function findUnusedEnglish(english, texts) {
  const literals = new Set();
  const patterns = [];
  for (const text of texts) {
    for (const match of text.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)) {
      literals.add(match[1] ?? match[2]);
    }
    for (const match of text.matchAll(/`([^`]*)`/g)) {
      const parts = match[1].split(/\$\{[^}]*\}/);
      if (parts.length < 2 || parts.join('').length < 2) continue;
      const escaped = parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      patterns.push(new RegExp(`^${escaped.join('.+')}$`));
    }
  }
  const unused = [];
  for (const [ns, entries] of Object.entries(english)) {
    for (const unit of unitsOf(entries)) {
      const used =
        literals.has(unit.key) ||
        literals.has(`${ns}:${unit.key}`) ||
        patterns.some((pattern) => pattern.test(unit.key));
      if (!used) unused.push(`${ns}:${unit.key}`);
    }
  }
  return unused;
}

function main() {
  const english = loadEnglish();
  const errors = checkEnglish(english);
  const warnings = [];
  const locales = translatedLocales().filter((locale) => !pseudoLocales.includes(locale));
  for (const locale of locales) {
    const meta = readJsonFile(path.join(metaDir, `${locale}.json`)) ?? {};
    const result = checkLocale(english, locale, loadMessages(locale), meta);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }
  const texts = sourceFiles(path.join(appDir, 'src')).map((file) =>
    fs.readFileSync(file, 'utf8'),
  );
  const unused = findUnusedEnglish(english, texts);
  if (unused.length) {
    errors.push(
      `English keys no source file seems to use (heuristic): ${unused.join(', ')}`,
    );
  }

  for (const warning of warnings) console.warn(`warning: ${warning}`);
  for (const error of errors) console.error(`error: ${error}`);
  const summary = `i18n:check: ${locales.length} locale(s) (${locales.join(', ') || 'none'}), ${errors.length} error(s), ${warnings.length} warning(s)`;
  if (errors.length) {
    console.error(`${summary}.\nMissing translations: run \`yarn i18n:translate\`.`);
    return 1;
  }
  console.log(`${summary}.`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main());
