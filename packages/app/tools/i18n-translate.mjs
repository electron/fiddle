#!/usr/bin/env node
// `yarn i18n:translate [--locale <code>] [--dry-run [--json]] [--from <file>]`
// translates new and changed English strings into each shipped locale with an
// LLM (ANTHROPIC_API_KEY; FIDDLE_TRANSLATE_MODEL overrides the model).
//
// src/i18n/translations/<locale>.json records { source, translation, reviewed } per
// key. A translation with no entry, or edited since the script wrote it, is
// human-reviewed and never overwritten; i18n:check warns when English changes under it.
// To keep a reviewed translation after such a change, set its `source` to the new hash.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

import {
  appDir,
  categoriesFor,
  glossaryFile,
  hashValue,
  keysFor,
  loadEnglish,
  loadMessages,
  localesDir,
  metaDir,
  pseudoLocales,
  readJsonFile,
  readUnit,
  sourceHash,
  translatedLocales,
  unitsOf,
  validateUnit,
  writeJsonFile,
  writeUnit,
} from './i18n-shared.mjs';

const BATCH_SIZE = 40;
// A batch's reply is not streamed and can take minutes; a hung request must not stall the run.
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
export const DEFAULT_MODEL = 'claude-opus-5';

/** Compares a locale with English and its state: what to translate, flag and remove. */
export function planLocale(english, locale, messages, meta) {
  const plan = { todo: [], review: [], removed: [], humanEdits: [] };
  const nextMessages = {};
  const nextMeta = {};
  for (const [ns, entries] of Object.entries(english)) {
    const current = messages[ns] ?? {};
    const out = {};
    for (const unit of unitsOf(entries)) {
      const id = `${ns}:${unit.key}`;
      const value = readUnit(unit, locale, current);
      if (value === undefined) {
        plan.todo.push({ ns, unit, reason: 'new' });
        continue;
      }
      writeUnit(unit, locale, out, value);
      const source = sourceHash(unit);
      let entry = meta[id];
      const translation = hashValue(value);
      if (!entry || entry.translation !== translation) {
        // Written or edited by a human, which counts as reviewing today's English.
        entry = { source, translation, reviewed: true };
        plan.humanEdits.push(id);
      }
      if (entry.source !== source) {
        if (entry.reviewed) plan.review.push({ ns, unit, source });
        else plan.todo.push({ ns, unit, reason: 'changed', previous: value });
      }
      nextMeta[id] = entry;
    }
    for (const key of Object.keys(current))
      if (!(key in out)) plan.removed.push(`${ns}:${key}`);
    nextMessages[ns] = out;
  }
  for (const [ns, current] of Object.entries(messages)) {
    if (!(ns in english))
      for (const key of Object.keys(current)) plan.removed.push(`${ns}:${key}`);
  }
  return { plan, messages: nextMessages, meta: nextMeta };
}

/** The glossary as the model sees it for one locale. */
export function glossaryFor(glossary, locale) {
  const fixed = {};
  for (const [term, translations] of Object.entries(glossary?.fixed ?? {})) {
    if (translations[locale]) fixed[term] = translations[locale];
  }
  return {
    untranslated: glossary?.untranslated ?? {},
    fixed,
    style: [glossary?.style?.['*'], glossary?.style?.[locale]].filter(Boolean),
  };
}

function requestUnit({ unit, previous }, locale) {
  return {
    key: unit.key,
    english: unit.plural ? unit.forms : unit.message,
    description: unit.description,
    ...(typeof unit.maxLength === 'number' && { maxLength: unit.maxLength }),
    ...(unit.plural && { forms: categoriesFor(unit, locale) }),
    ...(previous !== undefined && { previous }),
  };
}

/** Orders a namespace's messages like English. */
function ordered(entries, locale, messages) {
  const out = {};
  for (const unit of unitsOf(entries)) {
    for (const key of keysFor(unit, locale))
      if (key in messages) out[key] = messages[key];
  }
  return out;
}

/** Plans a locale and, unless `dryRun`, sends `translate` batches: `(request) -> { [unitKey]: string | { category: string } }`. */
export async function translateLocale({
  english,
  locale,
  messages,
  meta,
  glossary,
  translate,
  dryRun,
}) {
  const {
    plan,
    messages: out,
    meta: nextMeta,
  } = planLocale(english, locale, messages, meta);
  const requests = [];
  const failed = [];
  const byNamespace = Map.groupBy(plan.todo, (item) => item.ns);
  for (const [ns, items] of byNamespace) {
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const request = {
        locale,
        namespace: ns,
        glossary: glossaryFor(glossary, locale),
        units: batch.map((item) => requestUnit(item, locale)),
      };
      requests.push(request);
      if (dryRun || !translate) continue;
      let result;
      try {
        result = (await translate(request)) ?? {};
      } catch (error) {
        for (const { unit } of batch)
          failed.push({ id: `${ns}:${unit.key}`, problems: [error.message] });
        continue;
      }
      for (const { unit } of batch) {
        const id = `${ns}:${unit.key}`;
        const value = result[unit.key];
        const problems =
          value === undefined
            ? ['no translation returned']
            : validateUnit(unit, locale, value);
        if (problems.length) {
          failed.push({ id, problems });
          continue;
        }
        writeUnit(unit, locale, out[ns], value);
        nextMeta[id] = {
          source: sourceHash(unit),
          translation: hashValue(value),
          reviewed: false,
        };
      }
    }
  }
  const sortedMessages = {};
  for (const [ns, entries] of Object.entries(english)) {
    sortedMessages[ns] = ordered(entries, locale, out[ns] ?? {});
  }
  const sortedMeta = Object.fromEntries(
    Object.entries(nextMeta).sort(([a], [b]) => a.localeCompare(b, 'en')),
  );
  return { plan, requests, failed, messages: sortedMessages, meta: sortedMeta };
}

const SYSTEM_PROMPT = `You translate the user interface of Electron Fiddle, a desktop app for trying out Electron, the framework for building desktop apps with web technologies.

The user message is JSON with the target \`locale\`, a \`glossary\` and the \`units\` to translate. Each unit has:
- \`key\`: its ID;
- \`english\`: the English text, or for plural units an object of English plural forms;
- \`description\`: where the text appears and what it means;
- \`maxLength\` (optional): the maximum visible length, counting each {{placeholder}} as 3 characters;
- \`forms\` (plural units only): the CLDR plural categories the target locale needs;
- \`previous\` (optional): the old translation of a string whose English changed. Keep its wording where it still fits.

Rules:
- Terms in glossary.untranslated stay exactly as written. Terms in glossary.fixed always use the given translation. Follow glossary.style.
- Keep {{placeholders}}, $t(...) references and tags such as <0> or <strong> exactly, with the same names. They may move within the sentence. A plural form may omit {{count}} if the language needs it to, but no other placeholder.
- Never exceed maxLength. Prefer shorter natural wording to abbreviations.
- Write natural, idiomatic UI text a professional localizer would ship, consistent in terminology across units.

Reply with only a JSON object that maps each unit's key to its translation: a string, or for plural units an object with exactly the keys listed in \`forms\`.`;

/** Parses the first JSON object in a model reply (tolerating code fences). */
export function parseReply(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('the model reply has no JSON object');
  return JSON.parse(text.slice(start, end + 1));
}

/** A `translate` function backed by the Anthropic Messages API. */
export function anthropicTranslator({
  apiKey,
  model = DEFAULT_MODEL,
  fetchImpl = globalThis.fetch,
}) {
  // These models retry on a fallback model when a request is declined.
  const fallback = /^claude-(opus-5|fable-5-1)\b/.test(model);
  return async (request) => {
    const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        ...(fallback && { 'anthropic-beta': 'server-side-fallback-2026-07-01' }),
      },
      signal: globalThis.AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        model,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(request, null, 2) }],
        ...(fallback && { fallbacks: 'default' }),
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Anthropic API ${response.status}: ${(await response.text()).slice(0, 500)}`,
      );
    }
    const body = await response.json();
    if (body.stop_reason === 'refusal') throw new Error('the model declined the request');
    if (body.stop_reason === 'max_tokens')
      throw new Error('the reply was cut off (max_tokens)');
    const text = body.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');
    return parseReply(text);
  };
}

/** A `translate` function that reads `{ "<locale>": { "<ns>:<key>": value } }` from a file. */
export function fileTranslator(file) {
  const data = readJsonFile(path.resolve(file));
  if (!data) throw new Error(`${file} not found`);
  return async ({ locale, namespace, units }) => {
    const out = {};
    for (const { key } of units) {
      const value = data[locale]?.[`${namespace}:${key}`];
      if (value !== undefined) out[key] = value;
    }
    return out;
  };
}

function describe(locale, { plan, failed }, dryRun) {
  const counts = (reason) => plan.todo.filter((item) => item.reason === reason).length;
  const lines = [
    `${locale}: ${plan.todo.length} to translate (${counts('new')} new, ${counts('changed')} changed), ` +
      `${plan.review.length} flagged for re-review, ${plan.removed.length} removed, ` +
      `${plan.humanEdits.length} human edit(s) recorded` +
      (dryRun ? '' : `, ${failed.length} failed`),
  ];
  if (dryRun) {
    for (const item of plan.todo)
      lines.push(`  ${item.reason.padEnd(8)} ${item.ns}:${item.unit.key}`);
  }
  for (const item of plan.review) {
    lines.push(
      `  review   ${item.ns}:${item.unit.key} (English changed; source is now ${item.source})`,
    );
  }
  if (dryRun) for (const id of plan.removed) lines.push(`  remove   ${id}`);
  for (const { id, problems } of failed)
    lines.push(`  failed   ${id}: ${problems.join('; ')}`);
  return lines.join('\n');
}

/** Writes a locale's namespaces and state. Empty namespaces have no file. */
export function writeLocale(
  locale,
  messages,
  meta,
  { dir = localesDir, stateDir = metaDir } = {},
) {
  const localeDir = path.join(dir, locale);
  for (const name of fs.existsSync(localeDir) ? fs.readdirSync(localeDir) : []) {
    const ns = name.replace(/\.json$/, '');
    if (name.endsWith('.json') && !Object.keys(messages[ns] ?? {}).length) {
      fs.rmSync(path.join(localeDir, name));
    }
  }
  for (const [ns, flat] of Object.entries(messages)) {
    if (Object.keys(flat).length) writeJsonFile(path.join(localeDir, `${ns}.json`), flat);
  }
  writeJsonFile(path.join(stateDir, `${locale}.json`), meta);
}

async function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      locale: { type: 'string', multiple: true },
      'dry-run': { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      from: { type: 'string' },
    },
  });
  const dryRun = values['dry-run'];
  const locales = values.locale ?? translatedLocales();
  for (const locale of locales) {
    if (locale === 'en' || pseudoLocales.includes(locale)) {
      throw new Error(
        `${locale} isn't translated: English is the source and pseudo-locales are generated`,
      );
    }
    Intl.getCanonicalLocales(locale);
  }
  if (!locales.length) {
    console.log('No shipped locales yet. Start one with --locale <code>.');
    return 0;
  }

  let translate;
  if (values.from) translate = fileTranslator(values.from);
  else if (!dryRun) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
      throw new Error('Set ANTHROPIC_API_KEY, or use --dry-run or --from <file>.');
    translate = anthropicTranslator({
      apiKey,
      model: process.env.FIDDLE_TRANSLATE_MODEL || DEFAULT_MODEL,
    });
  }

  const english = loadEnglish();
  const glossary = readJsonFile(glossaryFile);
  const json = {};
  let failures = 0;
  for (const locale of locales) {
    const meta = readJsonFile(path.join(metaDir, `${locale}.json`)) ?? {};
    const result = await translateLocale({
      english,
      locale,
      messages: loadMessages(locale),
      meta,
      glossary,
      translate,
      dryRun,
    });
    failures += result.failed.length;
    if (values.json) json[locale] = result.requests;
    else console.log(describe(locale, result, dryRun));
    if (!dryRun) writeLocale(locale, result.messages, result.meta);
  }
  if (values.json) console.log(JSON.stringify(json, null, 2));
  if (!dryRun) {
    console.log(
      `Updated src/i18n/locales and ${path.relative(appDir, metaDir)}. Run \`yarn generate\`.`,
    );
  }
  return failures ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(`i18n:translate: ${error.message}`);
      process.exit(1);
    },
  );
}
