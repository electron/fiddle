import { RunnableVersion } from '../../src/interfaces';

export class BisectorMock {
  public revList: Array<RunnableVersion> = [];
  public minRev: number = 0;
  public maxRev: number = 0;
  public pivot: number = 0;

  public getCurrentVersion = jest.fn();
  public continue = jest.fn();
  public calculatePivot = jest.fn();
}
