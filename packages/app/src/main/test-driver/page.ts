/**
 * One app window's page, driven through `webContents.debugger` (CDP): the
 * accessibility tree for queries, and `Input.*` for clicks, keys and typing.
 * CDP input goes straight to the page's widget, so it needs no OS focus, and
 * the page emulates focus (`Emulation.setFocusEmulationEnabled`): it behaves
 * as the focused, active page whether or not its window is the key window.
 * That's what lets spec files run in parallel on one desktop (macOS), and
 * changes nothing on a display of their own (Xvfb). Every lookup waits for
 * its condition with `poll`, up to a timeout.
 */
import fs from 'node:fs/promises';

import type { WebContents } from 'electron';

import { describeQuery, formatSnapshot, matchNodes, nameOf, roleOf, statesOf, type AXNode } from './ax';
import { keyForCharacter, parseKeyCombo } from './keys';
import type { ElementInfo, Query } from './protocol';

export const DEFAULT_TIMEOUT = 5000;
const POLL_INTERVAL = 50;

type Attempt<T> = { value: T } | { reason: string };

/** Retries `attempt` until it returns a value; fails with the last reason after `timeout` ms. */
export async function poll<T>(
  what: string,
  timeout: number,
  attempt: () => Promise<Attempt<T>> | Attempt<T>,
): Promise<T> {
  const deadline = Date.now() + timeout;
  let reason: string;
  for (;;) {
    try {
      const result = await attempt();
      if ('value' in result) return result.value;
      reason = result.reason;
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    }
    if (Date.now() >= deadline) {
      throw new Error(`${what}: timed out after ${timeout} ms (${reason})`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The element (or a descendant) is what's hit at its center. */
  hit: boolean;
  hitDescription: string;
}

/**
 * Runs on the resolved DOM node: scrolls it into view if needed, then measures
 * and hit-tests it. A control that's visually hidden inside its <label> (React
 * Aria clips the real input of a switch, checkbox or radio to a pixel, which
 * can even drift outside the label) is measured by its label, where a user
 * would click.
 */
const BOX_FUNCTION = `function () {
  const el = this.nodeType === 1 ? this : this.parentElement;
  if (!el) return null;
  const label = this.nodeType === 1 && el.labels && el.labels.length > 0 ? el.labels[0] : null;
  let clipped = false;
  for (let node = el; label && label.contains(el) && node && node !== label; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.clip !== 'auto' || style.clipPath !== 'none' || (node.offsetWidth <= 1 && node.offsetHeight <= 1)) clipped = true;
  }
  const box = clipped ? label : el;
  const measure = () => {
    if (this.nodeType !== 3) return box.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(this);
    return range.getBoundingClientRect();
  };
  let r = measure();
  if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) {
    box.scrollIntoView({ block: 'center', inline: 'center' });
    r = measure();
  }
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const hit = document.elementFromPoint(x, y);
  // A hit inside the element's <label> counts too: a switch's input sits under its visual track.
  const inLabel = !!hit && !!el.labels && Array.from(el.labels).some((label) => label.contains(hit));
  const ok = !!hit && (hit === el || el.contains(hit) || inLabel || !!(hit.shadowRoot && hit.shadowRoot.contains(el)));
  const describe = (node) => node
    ? node.tagName.toLowerCase() + (node.id ? '#' + node.id : '') +
      (typeof node.className === 'string' && node.className.trim() ? '.' + node.className.trim().split(/\\s+/).join('.') : '')
    : 'nothing';
  return { x, y, width: r.width, height: r.height, hit: ok, hitDescription: describe(hit) };
}`;

export interface PageSetup {
  locale: string;
  timezone: string;
  /** Runs before any page script in every document (seeded Math.random). */
  initScript: string;
}

let pageSetup: PageSetup | undefined;

export function configurePages(setup: PageSetup): void {
  pageSetup = setup;
}

const pages = new WeakMap<WebContents, Page>();

export function pageFor(contents: WebContents): Page {
  let page = pages.get(contents);
  if (!page) {
    page = new Page(contents);
    pages.set(contents, page);
  }
  return page;
}

type Found = { info: ElementInfo; box: Box | undefined };

export class Page {
  readonly contents: WebContents;
  #ready: Promise<void> | undefined;

  constructor(contents: WebContents) {
    this.contents = contents;
  }

  /** Attaches the debugger once and applies the emulation overrides. Safe to call repeatedly. */
  attach(): Promise<void> {
    const dbg = this.contents.debugger;
    if (this.#ready && dbg.isAttached()) return this.#ready;
    const ready = (async () => {
      if (!dbg.isAttached()) dbg.attach('1.3');
      await dbg.sendCommand('DOM.enable');
      await dbg.sendCommand('Accessibility.enable');
      // document.hasFocus(), focus and blur events, :focus and the selection all
      // behave as in the key window, whichever window the OS gives focus to.
      await dbg.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true });
      if (pageSetup) {
        await dbg.sendCommand('Emulation.setTimezoneOverride', {
          timezoneId: pageSetup.timezone,
        });
        await dbg.sendCommand('Emulation.setLocaleOverride', { locale: pageSetup.locale });
        await dbg.sendCommand('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
        });
        await dbg.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
          source: pageSetup.initScript,
        });
      }
    })();
    this.#ready = ready;
    ready.catch(() => {
      if (this.#ready === ready) this.#ready = undefined;
    });
    return ready;
  }

  async send<T>(method: string, params?: object): Promise<T> {
    await this.attach();
    return (await this.contents.debugger.sendCommand(method, params)) as T;
  }

  /**
   * Dispatches an `Input.*` event, which resolves once the page has handled
   * it. An event that closes its own window (Cmd+W, a Close button) takes the
   * target away before it or the events after it are acknowledged: that
   * action is done, not failed.
   */
  async #input(method: string, params: object): Promise<void> {
    if (this.contents.isDestroyed()) return;
    try {
      await this.send(method, params);
    } catch (error) {
      if (this.contents.isDestroyed() || /target closed/i.test(String(error))) return;
      throw error;
    }
  }

  async axNodes(): Promise<AXNode[]> {
    const { nodes } = await this.send<{ nodes: AXNode[] }>('Accessibility.getFullAXTree');
    return nodes;
  }

  async snapshot(): Promise<string> {
    return formatSnapshot(await this.axNodes());
  }

  /** Evaluates in the renderer's main world, awaiting promises; returns a JSON-able value. */
  async evaluate(expression: string): Promise<unknown> {
    const response = await this.send<{
      result: { value?: unknown };
      exceptionDetails?: { text: string; exception?: { description?: string } };
    }>('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (response.exceptionDetails) {
      const { exception, text } = response.exceptionDetails;
      throw new Error(exception?.description ?? text);
    }
    return response.result.value;
  }

  async #box(backendNodeId: number): Promise<Box | undefined> {
    const { object } = await this.send<{ object: { objectId?: string } }>(
      'DOM.resolveNode',
      { backendNodeId },
    );
    const objectId = object.objectId;
    if (!objectId) return undefined;
    try {
      const { result } = await this.send<{ result: { value?: Box | null } }>(
        'Runtime.callFunctionOn',
        { objectId, functionDeclaration: BOX_FUNCTION, returnByValue: true },
      );
      return result.value ?? undefined;
    } finally {
      this.contents.debugger
        .sendCommand('Runtime.releaseObject', { objectId })
        .catch(() => undefined);
    }
  }

  async #describe(node: AXNode): Promise<Found> {
    const box =
      node.backendDOMNodeId === undefined ? undefined : await this.#box(node.backendDOMNodeId);
    return {
      box,
      info: {
        role: roleOf(node),
        name: nameOf(node),
        x: Math.round(box?.x ?? 0),
        y: Math.round(box?.y ?? 0),
        width: Math.round(box?.width ?? 0),
        height: Math.round(box?.height ?? 0),
        states: statesOf(node),
      },
    };
  }

  /** Waits for at least one match (or none, for `absent`) and describes the matches. */
  query(query: Query, state: 'present' | 'absent' = 'present'): Promise<ElementInfo[]> {
    return poll<ElementInfo[]>(`query ${describeQuery(query)}`, query.timeout ?? DEFAULT_TIMEOUT, async () => {
      const matches = matchNodes(await this.axNodes(), query);
      if (state === 'absent') {
        return matches.length === 0
          ? { value: [] }
          : { reason: `${matches.length} match(es) still present` };
      }
      const selected =
        query.nth === undefined ? matches : matches.slice(query.nth, query.nth + 1);
      if (selected.length === 0) {
        return { reason: matches.length === 0 ? 'no match' : `only ${matches.length} match(es)` };
      }
      const found = await Promise.all(selected.slice(0, 50).map((n) => this.#describe(n)));
      return { value: found.map((f) => f.info) };
    });
  }

  /** Waits for exactly one enabled match (or `nth`) that has a size and is on top at its center. */
  actionable(query: Query): Promise<ElementInfo> {
    return poll<ElementInfo>(`find ${describeQuery(query)}`, query.timeout ?? DEFAULT_TIMEOUT, async () => {
      const matches = matchNodes(await this.axNodes(), query);
      if (matches.length === 0) return { reason: 'no match' };
      if (query.nth === undefined && matches.length > 1) {
        const list = matches
          .slice(0, 5)
          .map((m) => `${roleOf(m)} ${JSON.stringify(nameOf(m))}`)
          .join(', ');
        return { reason: `${matches.length} matches (${list}); narrow the query or pass nth` };
      }
      const node = matches[query.nth ?? 0];
      if (!node) return { reason: `only ${matches.length} match(es)` };
      const { info, box } = await this.#describe(node);
      if (info.states.includes('disabled')) return { reason: 'the element is disabled' };
      if (!box || box.width === 0 || box.height === 0) return { reason: 'the element has no size' };
      if (!box.hit) return { reason: `the element is covered by ${box.hitDescription}` };
      return { value: info };
    });
  }

  /** A left click at the center of the match. Each event resolves once the renderer has handled it. */
  async click(query: Query): Promise<ElementInfo> {
    const element = await this.actionable(query);
    const at = { x: element.x, y: element.y };
    await this.#input('Input.dispatchMouseEvent', { type: 'mouseMoved', ...at, button: 'none', buttons: 0 });
    await this.#input('Input.dispatchMouseEvent', { type: 'mousePressed', ...at, button: 'left', buttons: 1, clickCount: 1 });
    await this.#input('Input.dispatchMouseEvent', { type: 'mouseReleased', ...at, button: 'left', buttons: 0, clickCount: 1 });
    return element;
  }

  /**
   * Types into whatever has focus, a key at a time: keydown, keypress and input,
   * then keyup, as from a US keyboard. Characters it has no key for (é, emoji)
   * are inserted as text, as an input method would. `\n` presses Enter.
   */
  async type(text: string): Promise<void> {
    for (const char of text) {
      if (char === '\n') {
        await this.press('Enter');
        continue;
      }
      const definition = keyForCharacter(char);
      if (!definition) {
        await this.#input('Input.insertText', { text: char });
        continue;
      }
      const key = { key: char, code: definition.code, windowsVirtualKeyCode: definition.keyCode };
      await this.#input('Input.dispatchKeyEvent', { type: 'keyDown', ...key, text: char, unmodifiedText: char });
      await this.#input('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
    }
  }

  /**
   * Presses a combo such as `Enter`, `Escape`, `CmdOrCtrl+S` or `Shift+Tab`:
   * one keydown with the modifiers held (and a keypress if it types
   * something), then the keyup. A key the page doesn't handle goes no further:
   * the native menu never sees it, exactly as with a display of one's own, so
   * shortcuts work through the renderer's keybinding dispatcher.
   */
  async press(combo: string): Promise<void> {
    const { key, code, keyCode, modifiers, text, commands } = parseKeyCombo(combo, process.platform);
    const held = { key, code, windowsVirtualKeyCode: keyCode, modifiers };
    await this.#input('Input.dispatchKeyEvent', {
      type: text === undefined ? 'rawKeyDown' : 'keyDown',
      ...held,
      ...(text === undefined ? {} : { text, unmodifiedText: text }),
      ...(commands.length > 0 ? { commands } : {}),
    });
    await this.#input('Input.dispatchKeyEvent', { type: 'keyUp', ...held });
  }

  async screenshot(file: string): Promise<{ path: string; width: number; height: number }> {
    const image = await this.contents.capturePage();
    await fs.writeFile(file, image.toPNG());
    return { path: file, ...image.getSize() };
  }

  /** Two animation frames pass and no animation is running. True if frames aren't produced at all. */
  async framesIdle(): Promise<boolean> {
    const idle = await this.evaluate(`new Promise((resolve) => {
      const timer = setTimeout(() => resolve(true), 1000);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        clearTimeout(timer);
        resolve(document.getAnimations().every((a) => a.playState !== 'running'));
      }));
    })`);
    return idle === true;
  }
}
