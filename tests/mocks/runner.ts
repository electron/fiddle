import { vi } from 'vitest';

export class RunnerMock {
  public autobisect = vi.fn();
  public run = vi.fn();
  public stop = vi.fn();
}
