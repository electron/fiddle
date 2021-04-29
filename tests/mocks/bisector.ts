import { RunnableVersion } from '../../src/interfaces';

export class BisectorMock {
  public revList: Array<RunnableVersion>;
  public minRev: number;
  public maxRev: number;
  public pivot: number;

  public getCurrentVersion = jest.fn();
  public continue = jest.fn();
  public calculatePivot = jest.fn();
}
