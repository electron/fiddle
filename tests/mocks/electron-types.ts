export class ElectronTypesMock {
  public setVersion = jest.fn();
  public uncache = jest.fn();
}

export interface NodeTypesMock {
  path: string;
  type: string;
  contentType: string;
  integrity: string;
  lastModified: string;
  size: number;
}
