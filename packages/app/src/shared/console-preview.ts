import type { ConsoleValue } from './stores';

/** A piece of a value's preview. `type` picks its colour; plain punctuation has none. */
export interface PreviewToken {
  text: string;
  type?: ConsoleValue['type'] | 'key' | 'more';
}

const PREVIEW_PROPS = 5;
const PREVIEW_STRING = 50;

/** An object or array that can be opened to show its properties. */
export function isExpandable(value: ConsoleValue): boolean {
  return (value.props?.length ?? 0) > 0 || (value.more ?? 0) > 0;
}

const quote = (text: string, max = Infinity) =>
  `'${text.length > max ? `${text.slice(0, max)}…` : text}'`;

/** A value inside another's preview: `{…}`, `Array(3)`, `ƒ`, `'text'`. */
function abbreviated(value: ConsoleValue): PreviewToken {
  switch (value.type) {
    case 'string':
      return { text: quote(value.description, PREVIEW_STRING), type: 'string' };
    case 'function':
      return { text: 'ƒ', type: 'function' };
    case 'object':
      return { text: value.description === 'Object' ? '{…}' : value.description };
    case 'array':
    case 'map':
    case 'set':
      return { text: value.description };
    case 'error':
      return { text: value.description.split('\n')[0] ?? '', type: 'error' };
    default:
      return { text: value.description, type: value.type };
  }
}

/**
 * The one-line preview DevTools shows for a value: `{a: 1, b: ƒ, …}`,
 * `(3) [1, 2, 3]`, `Map(1) {'k' => 'v'}`. A string is quoted unless `top`,
 * as the argument of a console call is printed as is.
 */
export function previewTokens(value: ConsoleValue, top = false): PreviewToken[] {
  if (value.type === 'string')
    return [{ text: top ? value.description : quote(value.description), type: 'string' }];
  const { props } = value;
  if (!props)
    return [
      value.type === 'function'
        ? { text: value.description, type: 'function' }
        : abbreviated(value),
    ];

  const isArray = value.type === 'array';
  const tokens: PreviewToken[] = [];
  if (isArray) {
    const size = /^(\w+)(\(\d+\))$/.exec(value.description);
    tokens.push({
      text: size?.[1] === 'Array' ? `${size[2]} [` : `${value.description} [`,
    });
  } else {
    const named = value.type !== 'object' || value.description !== 'Object';
    tokens.push({ text: named ? `${value.description} {` : '{' });
  }
  props.slice(0, PREVIEW_PROPS).forEach(([key, item], index) => {
    if (index > 0) tokens.push({ text: ', ' });
    if (value.type === 'map') tokens.push({ text: key, type: 'key' }, { text: ' => ' });
    else if (value.type === 'object' || (isArray && !/^\d+$/.test(key)))
      tokens.push({ text: key, type: 'key' }, { text: ': ' });
    tokens.push(abbreviated(item));
  });
  if (props.length > PREVIEW_PROPS || (value.more ?? 0) > 0)
    tokens.push({ text: props.length > 0 ? ', …' : '…', type: 'more' });
  tokens.push({ text: isArray ? ']' : '}' });
  return tokens;
}

/** A console call's arguments as one line of text, for the filter and copying. */
export function previewText(values: readonly ConsoleValue[]): string {
  return values
    .map((value) =>
      previewTokens(value, true)
        .map((token) => token.text)
        .join(''),
    )
    .join(' ');
}
