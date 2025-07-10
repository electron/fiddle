import { EventEmitter } from 'node:events';

import { vi } from 'vitest';

export class ChildProcessMock extends EventEmitter {
  public stdout = new EventEmitter();
  public stderr = new EventEmitter();
  public kill = vi.fn();
}
