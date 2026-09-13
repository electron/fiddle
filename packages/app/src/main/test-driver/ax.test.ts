import { describe, expect, it } from 'vitest';

import { describeQuery, formatSnapshot, matchNodes, type AXNode } from './ax';

const node = (
  nodeId: string,
  role: string,
  name: string,
  childIds: string[] = [],
  extra: Partial<AXNode> = {},
): AXNode => ({
  nodeId,
  ignored: false,
  role: { value: role },
  name: { value: name },
  childIds,
  backendDOMNodeId: Number(nodeId),
  ...extra,
});

const tree: AXNode[] = [
  node('1', 'RootWebArea', 'Electron Fiddle', ['2']),
  { ...node('2', 'generic', '', ['3', '4', '6', '8']), parentId: '1' },
  { ...node('3', 'heading', 'Welcome', [], { properties: [{ name: 'level', value: { value: 1 } }] }), parentId: '2' },
  { ...node('4', 'button', 'Run', ['5'], { properties: [{ name: 'disabled', value: { value: true } }] }), parentId: '2' },
  { ...node('5', 'StaticText', 'Run'), parentId: '4' },
  { ...node('6', 'button', 'Settings', ['7']), parentId: '2' },
  { ...node('7', 'StaticText', 'Gear'), parentId: '6' },
  { ...node('8', 'button', 'Hidden', [], { ignored: true }), parentId: '2' },
];

describe('formatSnapshot', () => {
  it('prints indented role "name" lines without noise', () => {
    expect(formatSnapshot(tree)).toBe(
      [
        'RootWebArea "Electron Fiddle"',
        '  heading "Welcome" [level=1]',
        '  button "Run" [disabled]',
        '  button "Settings"',
        '    StaticText "Gear"',
      ].join('\n'),
    );
  });
});

describe('matchNodes', () => {
  it('matches role and exact name', () => {
    expect(matchNodes(tree, { role: 'button', name: 'Run' }).map((n) => n.nodeId)).toEqual(['4']);
  });

  it('matches names by regex and skips ignored nodes', () => {
    const ids = matchNodes(tree, { role: 'button', name: { regex: '^(run|hidden)$', flags: 'i' } });
    expect(ids.map((n) => n.nodeId)).toEqual(['4']);
  });

  it('matches text by substring on text nodes only', () => {
    expect(matchNodes(tree, { text: 'Ge' }).map((n) => n.nodeId)).toEqual(['7']);
  });
});

describe('describeQuery', () => {
  it('describes each part', () => {
    expect(describeQuery({ role: 'button', name: { regex: 'run', flags: 'i' }, nth: 1 })).toBe(
      'role=button name=/run/i nth=1',
    );
  });
});
