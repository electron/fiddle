import { vi } from 'vitest';

export class FileManagerMock {
  public getFiles = vi.fn();
  public openFiddle = vi.fn();
  public saveToTemp = vi.fn().mockResolvedValue('/mock/temp/dir');
}
