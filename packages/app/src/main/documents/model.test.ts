import { describe, expect, it } from 'vitest';

import { createFiddle } from '../../fiddle/fiddle';
import {
  applyEdit,
  createDoc,
  DEFAULT_TEMPLATE,
  docAddFile,
  docRemoveFile,
  docRenameFile,
  docSetActiveFile,
  docSetFileVisible,
  isDirty,
  isTrusted,
  isUneditedTemplate,
  markSaved,
  toFiddleState,
} from './model';

const version = { kind: 'release', version: '30.0.0' } as const;

function templateDoc() {
  const fiddle = createFiddle({
    files: { 'main.js': 'main', 'index.html': '<html>', 'styles.css': '/* Empty */' },
    version,
    templateName: DEFAULT_TEMPLATE,
  });
  return createDoc(fiddle, 'sleepy-golden-otter');
}

describe('editor mirror', () => {
  it('starts clean, with the loaded files as the baseline', () => {
    const doc = templateDoc();
    expect(isDirty(doc)).toBe(false);
    expect(doc.fiddleRev).toBe(1);
    expect(doc.activeFile).toBe('main.js');
  });

  it('applies edits for the current fiddleRev and derives dirty from the baseline', () => {
    const doc = templateDoc();
    const edited = applyEdit(doc, 'main.js', 'changed', doc.fiddleRev)!;
    expect(edited.fiddle.files['main.js']).toBe('changed');
    expect(isDirty(edited)).toBe(true);

    const reverted = applyEdit(edited, 'main.js', 'main', doc.fiddleRev)!;
    expect(isDirty(reverted)).toBe(false);
  });

  it('counts hidden files when tracking changes', () => {
    const doc = templateDoc();
    expect(doc.fiddle.hidden).toContain('styles.css');
    expect(isDirty(applyEdit(doc, 'styles.css', 'body {}', doc.fiddleRev)!)).toBe(true);
  });

  it('drops edits that carry a stale fiddleRev', () => {
    const doc = templateDoc();
    const replaced = createDoc(doc.fiddle, doc.name, { previous: doc });
    expect(replaced.fiddleRev).toBe(2);
    expect(applyEdit(replaced, 'main.js', 'late', doc.fiddleRev)).toBeUndefined();
  });

  it('rejects edits to unknown files', () => {
    const doc = templateDoc();
    expect(() => applyEdit(doc, 'nope.js', 'x', doc.fiddleRev)).toThrow();
  });

  it('bumps fiddleRev when names change and keeps the active file sensible', () => {
    let doc = templateDoc();
    doc = docAddFile(doc, 'extra.js');
    expect(doc.fiddleRev).toBe(2);
    expect(doc.activeFile).toBe('extra.js');
    expect(isDirty(doc)).toBe(true);

    doc = docRenameFile(doc, 'extra.js', 'helper.js');
    expect(doc.fiddleRev).toBe(3);
    expect(doc.activeFile).toBe('helper.js');

    doc = docRemoveFile(doc, 'helper.js');
    expect(doc.activeFile).toBe('main.js');
    expect(isDirty(doc)).toBe(false);
  });

  it('shows a hidden file when it is focused, and moves focus off a hidden one', () => {
    let doc = docSetActiveFile(templateDoc(), 'styles.css');
    expect(doc.fiddle.hidden).not.toContain('styles.css');
    expect(doc.activeFile).toBe('styles.css');
    doc = docSetFileVisible(doc, 'styles.css', false);
    expect(doc.activeFile).toBe('main.js');
  });

  it('knows an unedited template', () => {
    const doc = templateDoc();
    expect(isUneditedTemplate(doc)).toBe(true);
    expect(isUneditedTemplate(applyEdit(doc, 'main.js', 'x', doc.fiddleRev)!)).toBe(false);
  });

  it('resets the baseline on save', () => {
    const doc = applyEdit(templateDoc(), 'main.js', 'x', 1)!;
    const saved = markSaved(doc, { localPath: '/tmp/f' });
    expect(isDirty(saved)).toBe(false);
    expect(saved.fiddle.source.localPath).toBe('/tmp/f');
  });
});

describe('toFiddleState', () => {
  it('lists files in display order with visibility', () => {
    const state = toFiddleState(templateDoc());
    expect(state.files).toEqual([
      { name: 'main.js', visible: true },
      { name: 'index.html', visible: true },
      { name: 'styles.css', visible: false },
    ]);
    expect(state.source).toEqual({ origin: 'local', trusted: true, templateName: DEFAULT_TEMPLATE });
    expect(state.dirty).toBe(false);
  });

  it('marks remote fiddles untrusted until their origin is approved', () => {
    const origin = { kind: 'gist', owner: 'octocat', id: 'a'.repeat(32), sha: 'b'.repeat(40) } as const;
    const doc = createDoc(createFiddle({ files: { 'main.js': '' }, version, origin }), 'x');
    expect(isTrusted(doc)).toBe(false);
    expect(toFiddleState(doc).source.trusted).toBe(false);
    const approved = { ...doc, approvedOrigin: `gist:octocat/${'a'.repeat(32)}@${'b'.repeat(40)}` };
    expect(isTrusted(approved)).toBe(true);
  });
});
