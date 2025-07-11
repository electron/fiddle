import { vi } from 'vitest';

import { RunnableVersion } from '../../src/interfaces';

export class BisectorMock {
  public revList: Array<RunnableVersion> = [];
  public minRev: number = 0;
  public maxRev: number = 0;
  public pivot: number = 0;

  public getCurrentVersion = vi.fn();
  public continue = vi.fn();
  public calculatePivot = vi.fn();
}
