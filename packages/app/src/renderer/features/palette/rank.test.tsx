import { describe, expect, it } from 'vitest';

import { matchScore, pushRecent, rankItems, type PaletteItem } from './rank';

const command = (
  id: string,
  label: string,
  extra: Partial<PaletteItem> = {},
): PaletteItem => ({
  id: `command:${id}`,
  kind: 'command',
  label,
  ...extra,
});

const items: PaletteItem[] = [
  command('app.newWindow', 'New window'),
  command('file.save', 'Save'),
  command('file.saveAs', 'Save as'),
  command('view.reload', 'Reload'),
  command('view.toggleDevTools', 'Toggle developer tools', { keywords: ['inspect'] }),
  { id: 'file:main.js', kind: 'file', label: 'main.js' },
  { id: 'file:renderer.js', kind: 'file', label: 'renderer.js' },
  { id: 'version:44.0.0', kind: 'version', label: '44.0.0', keywords: ['stable'] },
];

const labels = (list: PaletteItem[]) => list.map((item) => item.label);

describe('matchScore', () => {
  it('matches substrings and scattered letters, case-insensitively', () => {
    expect(matchScore('dev', 'Toggle developer tools')).not.toBeNull();
    expect(matchScore('tdt', 'Toggle developer tools')).not.toBeNull();
    expect(matchScore('xyz', 'Toggle developer tools')).toBeNull();
  });

  it.each([
    ['fenetre', 'Fenêtre'],
    ['FENETRE', 'Fenêtre'],
    ['cafe', 'café'],
    ['cafe', 'cafe\u0301'],
    ['cafe\u0301', 'Café'],
    ['ninos', 'Niños'],
    ['acao', 'Ação'],
    ['istanbul', 'İstanbul'],
    ['İstanbul', 'istanbul'],
    ['isik', 'Işık'],
    ['ısık', 'Isik'],
    ['guncelle', 'Güncelle'],
    ['ファイル', 'ファイルを開く'],
    ['파일', '새 파일'],
    ['窗口', '新建窗口'],
  ])('matches %s against %s regardless of case and accents', (query, text) => {
    expect(matchScore(query, text)).not.toBeNull();
  });

  it.each([
    ['か', 'が'],
    ['は', 'ぱ'],
    ['파', '팔'],
    ['е', 'ё'],
  ])('keeps non-Latin characters distinct: %s vs %s', (query, text) => {
    expect(matchScore(query, text)).toBeNull();
  });

  it('scores an accented text like its plain spelling', () => {
    expect(matchScore('fenetre', 'Fenêtre')).toBe(matchScore('fenetre', 'Fenetre'));
    expect(matchScore('istanbul', 'İstanbul')).toBe(matchScore('istanbul', 'Istanbul'));
  });

  it('ranks exact, then word-start, then later substrings', () => {
    const exact = matchScore('save', 'Save')!;
    const start = matchScore('save', 'Save as')!;
    const inner = matchScore('ave', 'Save as')!;
    expect(exact).toBeGreaterThan(start);
    expect(start).toBeGreaterThan(inner);
  });

  it('prefers substrings over scattered letters', () => {
    expect(matchScore('new', 'New window')!).toBeGreaterThan(
      matchScore('nw', 'New window')!,
    );
  });
});

describe('rankItems', () => {
  it('shows recent items first, then the other commands, when the query is empty', () => {
    const ranked = rankItems(items, '', ['command:view.reload', 'file:main.js']);
    expect(labels(ranked)).toEqual([
      'Reload',
      'main.js',
      'New window',
      'Save',
      'Save as',
      'Toggle developer tools',
    ]);
  });

  it('ignores recent IDs that no longer exist', () => {
    expect(labels(rankItems(items, '', ['command:gone']))[0]).toBe('New window');
  });

  it('searches every kind once there is a query', () => {
    expect(labels(rankItems(items, 'main', []))).toEqual(['main.js']);
    expect(labels(rankItems(items, '44', []))).toEqual(['44.0.0']);
  });

  it('orders matches by score and keeps input order for ties', () => {
    expect(labels(rankItems(items, 'save', []))).toEqual(['Save', 'Save as']);
    expect(labels(rankItems(items, 'js', []))).toEqual(['main.js', 'renderer.js']);
  });

  it('boosts recently used items', () => {
    const ranked = rankItems(items, 'js', ['file:renderer.js']);
    expect(labels(ranked)).toEqual(['renderer.js', 'main.js']);
  });

  it('matches keywords below labels', () => {
    expect(labels(rankItems(items, 'inspect', []))).toEqual(['Toggle developer tools']);
    expect(labels(rankItems(items, 'stable', []))).toEqual(['44.0.0']);
  });

  it('finds accented labels from unaccented queries', () => {
    const french = [command('window', 'Fenêtre'), command('save', 'Enregistrer')];
    expect(labels(rankItems(french, 'fenetre', []))).toEqual(['Fenêtre']);
  });

  it('respects the limit', () => {
    expect(rankItems(items, 'e', [], 2)).toHaveLength(2);
  });
});

describe('pushRecent', () => {
  it('moves the ID to the front without duplicates and caps the list', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
    expect(pushRecent(['a', 'b'], 'c', 2)).toEqual(['c', 'a']);
  });
});
