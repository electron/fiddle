// Tests for the i18n tools, with a mocked model: `yarn i18n:test`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { checkEnglish, checkLocale, findUnusedEnglish } from './i18n-check.mjs';
import {
  hashValue,
  pluralCategories,
  pseudoLocalize,
  pseudoMessages,
  sourceHash,
  unitsOf,
  validateUnit,
} from './i18n-shared.mjs';
import {
  DEFAULT_MODEL,
  anthropicTranslator,
  fileTranslator,
  translateLocale,
  writeLocale,
} from './i18n-translate.mjs';

const english = () => ({
  run: {
    runButton: {
      message: 'Run',
      description: 'Button that runs the fiddle.',
      maxLength: 12,
    },
    running: { message: 'Running {{name}}…', description: 'Status while a fiddle runs.' },
    errorCount_one: { message: '{{count}} error', description: 'Console error count.' },
    errorCount_other: {
      message: '{{count}} errors',
      description: 'Console error count.',
    },
  },
});

const glossary = {
  untranslated: { Electron: 'Product name.' },
  fixed: { Run: { de: 'Ausführen', ja: '実行' } },
  style: { '*': 'Sentence case.', de: 'Informal du.' },
};

/** A fake model: prefixes each English form with the locale, and records requests. */
function mockModel(overrides = {}) {
  const calls = [];
  const translate = async (request) => {
    calls.push(request);
    const out = {};
    for (const unit of request.units) {
      out[unit.key] =
        overrides[unit.key] ??
        (unit.forms
          ? Object.fromEntries(
              unit.forms.map((c) => [
                c,
                `${request.locale}:${unit.english[c] ?? unit.english.other}`,
              ]),
            )
          : `${request.locale}:${unit.english}`);
    }
    return out;
  };
  return { translate, calls };
}

const run = (locale, state, model, { eng = english(), dryRun = false } = {}) =>
  translateLocale({
    english: eng,
    locale,
    messages: state.messages,
    meta: state.meta,
    glossary,
    translate: model.translate,
    dryRun,
  });

const unit = (eng, key) => unitsOf(eng.run).find((u) => u.key === key);

test('translates new keys and records them as unreviewed machine translations', async () => {
  const model = mockModel();
  const result = await run('de', { messages: {}, meta: {} }, model);
  assert.deepEqual(result.messages.run, {
    runButton: 'de:Run',
    running: 'de:Running {{name}}…',
    errorCount_one: 'de:{{count}} error',
    errorCount_other: 'de:{{count}} errors',
  });
  assert.deepEqual(result.meta['run:runButton'], {
    source: sourceHash(unit(english(), 'runButton')),
    translation: hashValue('de:Run'),
    reviewed: false,
  });
  assert.equal(model.calls.length, 1);
  const [request] = model.calls;
  assert.deepEqual(request.glossary.fixed, { Run: 'Ausführen' });
  assert.deepEqual(request.glossary.style, ['Sentence case.', 'Informal du.']);
  assert.deepEqual(request.units[0], {
    key: 'runButton',
    english: 'Run',
    description: 'Button that runs the fiddle.',
    maxLength: 12,
  });
  assert.deepEqual(request.units[2].forms, ['one', 'other']);
  assert.deepEqual(result.failed, []);
});

test("asks for each locale's own plural categories", async () => {
  const model = mockModel();
  const result = await run('ja', { messages: {}, meta: {} }, model);
  assert.deepEqual(model.calls[0].units[2].forms, ['other']);
  assert.deepEqual(Object.keys(result.messages.run), [
    'runButton',
    'running',
    'errorCount_other',
  ]);
});

test('does nothing when English and the translations are unchanged', async () => {
  const first = await run('de', { messages: {}, meta: {} }, mockModel());
  const model = mockModel();
  const second = await run('de', first, model);
  assert.equal(model.calls.length, 0);
  assert.deepEqual(second.messages, first.messages);
  assert.deepEqual(second.meta, first.meta);
  assert.deepEqual(second.plan.humanEdits, []);
});

test('redoes a machine translation when its English changes, passing the old one', async () => {
  const first = await run('de', { messages: {}, meta: {} }, mockModel());
  const eng = english();
  eng.run.runButton.message = 'Run it';
  const model = mockModel();
  const second = await run('de', first, model, { eng });
  assert.equal(model.calls.length, 1);
  assert.deepEqual(model.calls[0].units, [
    {
      key: 'runButton',
      english: 'Run it',
      description: 'Button that runs the fiddle.',
      maxLength: 12,
      previous: 'de:Run',
    },
  ]);
  assert.equal(second.messages.run.runButton, 'de:Run it');
  assert.equal(second.meta['run:runButton'].source, sourceHash(unit(eng, 'runButton')));
});

test('never overwrites a human edit, and flags it for re-review when English changes', async () => {
  const first = await run('de', { messages: {}, meta: {} }, mockModel());
  first.messages.run.runButton = 'Los';

  // The edit is recorded as reviewed.
  let model = mockModel();
  const second = await run('de', first, model);
  assert.equal(model.calls.length, 0);
  assert.deepEqual(second.plan.humanEdits, ['run:runButton']);
  assert.deepEqual(second.meta['run:runButton'], {
    source: sourceHash(unit(english(), 'runButton')),
    translation: hashValue('Los'),
    reviewed: true,
  });

  // English changes: the reviewed text stays and is flagged, not retranslated.
  const eng = english();
  eng.run.runButton.message = 'Run it';
  model = mockModel();
  const third = await run('de', second, model, { eng });
  assert.equal(model.calls.length, 0);
  assert.equal(third.messages.run.runButton, 'Los');
  assert.deepEqual(
    third.plan.review.map((item) => `${item.ns}:${item.unit.key}`),
    ['run:runButton'],
  );
  assert.deepEqual(third.meta['run:runButton'], second.meta['run:runButton']);
  const { warnings } = checkLocale(eng, 'de', third.messages, third.meta);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /runButton: English changed since review/);

  // A human updates the translation: the flag clears and it stays theirs.
  third.messages.run.runButton = 'Ausführen';
  const fourth = await run('de', third, mockModel(), { eng });
  assert.deepEqual(fourth.plan.review, []);
  assert.equal(fourth.meta['run:runButton'].reviewed, true);
  assert.equal(fourth.meta['run:runButton'].source, sourceHash(unit(eng, 'runButton')));
  assert.equal(fourth.messages.run.runButton, 'Ausführen');
});

test('treats a translation with no state as written by a human', async () => {
  const model = mockModel();
  const result = await run(
    'de',
    { messages: { run: { runButton: 'Starten' } }, meta: {} },
    model,
  );
  assert.deepEqual(
    model.calls[0].units.map((u) => u.key),
    ['running', 'errorCount'],
  );
  assert.equal(result.messages.run.runButton, 'Starten');
  assert.equal(result.meta['run:runButton'].reviewed, true);
});

test('removes keys English dropped and plural forms the locale lacks', async () => {
  const first = await run('ja', { messages: {}, meta: {} }, mockModel());
  first.messages.run.errorCount_one = 'ja:one';
  first.messages.run.gone = 'ja:gone';
  first.messages.oldNamespace = { title: 'ja:old' };
  const result = await run('ja', first, mockModel());
  assert.deepEqual(result.plan.removed.sort(), [
    'oldNamespace:title',
    'run:errorCount_one',
    'run:gone',
  ]);
  assert.deepEqual(Object.keys(result.messages), ['run']);
  assert.deepEqual(Object.keys(result.messages.run), [
    'runButton',
    'running',
    'errorCount_other',
  ]);
});

test('rejects invalid model output and retries it on the next run', async () => {
  const model = mockModel({
    runButton: 'Jetzt sofort ausführen',
    running: 'Läuft…',
    errorCount: { one: '{{count}} Fehler', other: '{{count}} Fehler', few: 'x' },
  });
  const result = await run('de', { messages: {}, meta: {} }, model);
  const byId = Object.fromEntries(
    result.failed.map((f) => [f.id, f.problems.join('; ')]),
  );
  assert.match(byId['run:runButton'], /longer than maxLength 12/);
  assert.match(byId['run:running'], /missing placeholder \{\{name\}\}/);
  assert.match(byId['run:errorCount'], /invalid plural form "few"/);
  assert.deepEqual(result.messages.run, {});
  assert.deepEqual(result.meta, {});

  const retry = mockModel();
  const again = await run('de', result, retry);
  assert.equal(retry.calls[0].units.length, 3);
  assert.deepEqual(again.failed, []);
});

test('a dry run plans and builds requests without calling the model', async () => {
  const model = mockModel();
  const result = await run('de', { messages: {}, meta: {} }, model, { dryRun: true });
  assert.equal(model.calls.length, 0);
  assert.equal(result.plan.todo.length, 3);
  assert.equal(result.requests.length, 1);
  assert.equal(result.requests[0].units.length, 3);
});

test('writeLocale writes namespaces and state, and drops empty namespaces', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-test-'));
  try {
    const locales = path.join(dir, 'locales');
    const state = path.join(dir, 'translations');
    fs.mkdirSync(path.join(locales, 'de'), { recursive: true });
    fs.writeFileSync(path.join(locales, 'de', 'old.json'), '{}');
    writeLocale(
      'de',
      { run: { runButton: 'Ausführen' }, empty: {} },
      { a: 1 },
      { dir: locales, stateDir: state },
    );
    assert.deepEqual(fs.readdirSync(path.join(locales, 'de')), ['run.json']);
    assert.equal(
      fs.readFileSync(path.join(locales, 'de', 'run.json'), 'utf8'),
      '{\n  "runButton": "Ausführen"\n}\n',
    );
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(state, 'de.json'), 'utf8')), {
      a: 1,
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('anthropicTranslator posts to the Messages API and parses the JSON reply', async () => {
  const sent = [];
  const fetchImpl = async (url, init) => {
    sent.push({ url, init });
    return {
      ok: true,
      json: async () => ({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: '```json\n{ "runButton": "Ausführen" }\n```' }],
      }),
    };
  };
  const translate = anthropicTranslator({ apiKey: 'test-key', fetchImpl });
  const request = {
    locale: 'de',
    namespace: 'run',
    glossary: {},
    units: [{ key: 'runButton', english: 'Run' }],
  };
  assert.deepEqual(await translate(request), { runButton: 'Ausführen' });
  const [{ url, init }] = sent;
  assert.equal(url, 'https://api.anthropic.com/v1/messages');
  assert.equal(init.headers['x-api-key'], 'test-key');
  assert.equal(init.headers['anthropic-version'], '2023-06-01');
  const body = JSON.parse(init.body);
  assert.equal(body.model, DEFAULT_MODEL);
  assert.deepEqual(JSON.parse(body.messages[0].content), request);
  assert.match(body.system, /glossary/);
});

test('API errors fail the batch without writing anything', async () => {
  const translate = anthropicTranslator({
    apiKey: 'k',
    model: 'claude-haiku-4-5',
    fetchImpl: async () => ({ ok: false, status: 529, text: async () => 'overloaded' }),
  });
  const result = await translateLocale({
    english: english(),
    locale: 'de',
    messages: {},
    meta: {},
    glossary,
    translate,
  });
  assert.equal(result.failed.length, 3);
  assert.match(result.failed[0].problems[0], /Anthropic API 529/);
  assert.deepEqual(result.meta, {});
});

test('fileTranslator reads { locale: { "ns:key": value } }', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-test-'));
  try {
    const file = path.join(dir, 'de.json');
    fs.writeFileSync(file, JSON.stringify({ de: { 'run:runButton': 'Ausführen' } }));
    const translate = fileTranslator(file);
    const out = await translate({
      locale: 'de',
      namespace: 'run',
      units: [{ key: 'runButton' }, { key: 'running' }],
    });
    assert.deepEqual(out, { runButton: 'Ausführen' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('i18n-check reports missing, unused, plural, placeholder and tag problems', () => {
  const eng = english();
  eng.run.linked = { message: 'See <0>the docs</0>', description: 'Link.' };
  const clean = {
    run: {
      runButton: 'Ausführen',
      running: '{{name}} läuft …',
      errorCount_one: 'Ein Fehler',
      errorCount_other: '{{count}} Fehler',
      linked: 'Siehe <0>Doku</0>',
    },
  };
  assert.deepEqual(checkLocale(eng, 'de', clean), { errors: [], warnings: [] });

  const broken = {
    run: {
      runButton: 'Ausführen',
      running: 'Läuft {{title}}',
      errorCount_other: '{{count}} Fehler',
      linked: 'Siehe die Doku',
      extra: 'x',
    },
    nope: {},
  };
  const { errors } = checkLocale(eng, 'de', broken);
  assert.deepEqual(errors, [
    'de/nope.json: no English source; remove it',
    'de/run.json: running: unknown placeholder {{title}}',
    'de/run.json: running: missing placeholder {{name}}',
    'de/run.json: missing errorCount_one',
    'de/run.json: linked: tags differ from English: "" vs "</0> <0>"',
    'de/run.json: extra: unused (English has no such key)',
  ]);

  const ja = {
    run: {
      runButton: '実行',
      running: '{{name}} を実行中…',
      errorCount_one: 'x',
      errorCount_other: '{{count}} 件',
      linked: '<0>ドキュメント</0>を参照',
    },
  };
  assert.deepEqual(checkLocale(eng, 'ja', ja).errors, [
    'ja/run.json: errorCount_one: invalid plural form (ja uses other)',
  ]);

  assert.deepEqual(
    checkEnglish({
      run: {
        a_one: { message: 'x' },
        b_few: { message: 'x' },
        b_other: { message: 'y' },
      },
    }),
    [
      'en/run.json: a_one: plural key without a_other',
      'en/run.json: b_few: invalid plural form for English (use one, other or zero)',
    ],
  );
});

test('the unused-key scan accepts literals and template patterns', () => {
  const eng = {
    settings: {
      'appearance.dark': { message: 'Dark', description: 'x' },
      'notice.corrupt.title': { message: 'x', description: 'x' },
      orphan: { message: 'x', description: 'x' },
      // Used after a '\n' literal on the same line, which must not throw the scan off.
      unlisted: { message: 'x', description: 'x' },
    },
    run: english().run,
  };
  const texts = [
    't(`appearance.${value}`); t(`notice.${kind}.title`)',
    "t('runButton'); t(\"running\", { name }); t('errorCount', { count })",
    "lines.join('\\n') || t('unlisted')",
  ];
  assert.deepEqual(findUnusedEnglish(eng, texts), ['settings:orphan']);
});

test('validateUnit measures maxLength like generate does', () => {
  // {{file}} counts as 3 characters: "{{file}} öffnen" is 10 long, "Öffne {{file}}" 9.
  const u = {
    key: 'k',
    plural: false,
    message: 'Open {{file}}',
    maxLength: 9,
    description: 'x',
  };
  assert.deepEqual(validateUnit(u, 'de', '{{file}} öffnen'), ['longer than maxLength 9']);
  assert.deepEqual(validateUnit(u, 'de', 'Öffne {{file}}'), []);
});

test('pseudo-locales keep placeholders; en-XA is ~40% longer, ar-XB forces RTL', () => {
  const text = 'Running {{name}} on <0>Electron</0>';
  const xa = pseudoLocalize('en-XA', text);
  assert.match(xa, /^\[Ŕûññîñĝ \{\{name\}\} öñ <0>Éļéçţŕöñ<\/0> one/);
  assert.ok(xa.length >= text.length * 1.4, xa);

  const xb = pseudoLocalize('ar-XB', 'Run {{name}}');
  assert.equal(xb, '‏‮Run‬‏ {{name}}');

  // ar-XB gets all six Arabic plural forms, falling back to English `other`.
  const messages = pseudoMessages('ar-XB', english().run);
  assert.deepEqual(pluralCategories('ar-XB'), [
    'zero',
    'one',
    'two',
    'few',
    'many',
    'other',
  ]);
  for (const category of ['zero', 'two', 'few', 'many', 'other']) {
    assert.match(messages[`errorCount_${category}`], /errors/);
  }
  assert.match(messages.errorCount_one, /error‬/);
});
