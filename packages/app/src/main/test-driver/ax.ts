/**
 * Accessibility-tree queries and snapshots over CDP's
 * `Accessibility.getFullAXTree` nodes. Pure functions, no Electron imports.
 */
import type { Query, TextMatcher } from './protocol';

interface AXValue {
  value?: unknown;
}

export interface AXNode {
  nodeId: string;
  ignored: boolean;
  role?: AXValue;
  name?: AXValue;
  properties?: { name: string; value: AXValue }[];
  childIds?: string[];
  parentId?: string;
  backendDOMNodeId?: number;
}

/** Roles that only group; without a name they are left out of snapshots. */
const STRUCTURAL = new Set(['generic', 'none', 'presentation', 'LineBreak']);
const STATES = ['disabled', 'focused', 'checked', 'pressed', 'expanded', 'selected'];

export const roleOf = (node: AXNode): string => String(node.role?.value ?? '');
export const nameOf = (node: AXNode): string => String(node.name?.value ?? '').trim();

export function statesOf(node: AXNode): string[] {
  const states: string[] = [];
  for (const property of node.properties ?? []) {
    if (!STATES.includes(property.name)) continue;
    const value = property.value.value;
    if (value === true || value === 'true') states.push(property.name);
    else if (value === 'mixed') states.push(`${property.name}=mixed`);
  }
  return states;
}

function matchText(actual: string, matcher: TextMatcher, substring: boolean): boolean {
  if (typeof matcher === 'string') {
    return substring ? actual.includes(matcher) : actual === matcher.trim();
  }
  return new RegExp(matcher.regex, matcher.flags).test(actual);
}

/** Non-ignored nodes matching `query`, in document order. */
export function matchNodes(nodes: AXNode[], query: Query): AXNode[] {
  return nodes.filter((node) => {
    if (node.ignored || node.backendDOMNodeId === undefined) return false;
    const role = roleOf(node);
    if (role === 'InlineTextBox') return false;
    if (query.role !== undefined && role !== query.role) return false;
    if (query.name !== undefined && !matchText(nameOf(node), query.name, false))
      return false;
    if (query.text !== undefined) {
      if (role !== 'StaticText' || !matchText(nameOf(node), query.text, true))
        return false;
    }
    return true;
  });
}

export function describeQuery(query: Query): string {
  const show = (matcher: TextMatcher) =>
    typeof matcher === 'string'
      ? JSON.stringify(matcher)
      : `/${matcher.regex}/${matcher.flags ?? ''}`;
  const parts: string[] = [];
  if (query.role !== undefined) parts.push(`role=${query.role}`);
  if (query.name !== undefined) parts.push(`name=${show(query.name)}`);
  if (query.text !== undefined) parts.push(`text=${show(query.text)}`);
  if (query.nth !== undefined) parts.push(`nth=${query.nth}`);
  return parts.length > 0 ? parts.join(' ') : '(any element)';
}

/**
 * The tree as indented `role "name" [states]` lines. Ignored nodes, unnamed
 * structural nodes, inline text boxes, and text that only repeats its
 * parent's name are left out; their children move up a level.
 */
export function formatSnapshot(nodes: AXNode[]): string {
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  const root = nodes.find((node) => node.parentId === undefined) ?? nodes[0];
  if (!root) return '';
  const lines: string[] = [];

  const visit = (node: AXNode, depth: number, parentName: string): void => {
    const role = roleOf(node);
    const name = nameOf(node);
    const hidden =
      node.ignored ||
      role === 'InlineTextBox' ||
      (STRUCTURAL.has(role) && name === '') ||
      (role === 'StaticText' && (name === '' || name === parentName));
    let childDepth = depth;
    let childParentName = parentName;
    if (!hidden) {
      const states = statesOf(node);
      const level = node.properties?.find((p) => p.name === 'level')?.value.value;
      const extra = [
        ...(level === undefined ? [] : [`level=${String(level)}`]),
        ...states,
      ];
      lines.push(
        `${'  '.repeat(depth)}${role}${name ? ` ${JSON.stringify(name)}` : ''}${
          extra.length > 0 ? ` [${extra.join(', ')}]` : ''
        }`,
      );
      childDepth = depth + 1;
      childParentName = name;
    }
    for (const childId of node.childIds ?? []) {
      const child = byId.get(childId);
      if (child) visit(child, childDepth, childParentName);
    }
  };

  visit(root, 0, '');
  return lines.join('\n');
}
