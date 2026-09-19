/** Main-side handlers for the shared command definitions. Menus, the renderer (`Window.RunCommand`) and e2e tests all run commands by ID. No Electron imports. */
import { isCommandEnabled, isCommandId, type CommandId } from '../shared/commands';
import { ErrorCode, FiddleError } from '../shared/errors';
import type { StateHub } from './state-hub';

interface CommandContext {
  /** The window the command runs in, if any. */
  windowId: string | undefined;
}

type CommandHandler = (context: CommandContext) => void | Promise<void>;

export class CommandRegistry {
  readonly #handlers = new Map<CommandId, CommandHandler>();
  readonly #hub: StateHub;

  constructor(hub: StateHub) {
    this.#hub = hub;
  }

  register(id: CommandId, handler: CommandHandler): void {
    this.#handlers.set(id, handler);
  }

  isEnabled(id: CommandId, windowId: string | undefined): boolean {
    const win = windowId === undefined ? undefined : this.#hub.getWindow(windowId);
    return this.#handlers.has(id) && isCommandEnabled(id, this.#hub.app, win);
  }

  async run(id: string, context: CommandContext): Promise<void> {
    if (!isCommandId(id))
      throw new FiddleError(ErrorCode.notFound, `Unknown command: ${id}`);
    const handler = this.#handlers.get(id);
    if (!handler)
      throw new FiddleError(ErrorCode.unavailable, `Command ${id} has no handler`);
    if (!this.isEnabled(id, context.windowId)) {
      throw new FiddleError(ErrorCode.forbidden, `Command ${id} is disabled`);
    }
    await handler(context);
  }
}
