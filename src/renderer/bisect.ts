import { ElectronVersion } from '../interfaces';

export class Bisector {
  public revList: Array<ElectronVersion>;
  public minRev: number;
  public maxRev: number;
  private pivot: number;

  constructor(revList: Array<ElectronVersion>) {
    this.getCurrentVersion = this.getCurrentVersion.bind(this);
    this.continue = this.continue.bind(this);
    this.calculatePivot = this.calculatePivot.bind(this);

    this.revList = revList;
    this.minRev = 0;
    this.maxRev = revList.length - 1;
    this.calculatePivot();
  }

  public getCurrentVersion() {
    return this.revList[this.pivot];
  }

  public continue(isGoodVersion: boolean) {
    let isBisectOver = false;
    if (this.maxRev - this.minRev <= 1) {
      isBisectOver = true;
    }

    if (isGoodVersion) {
      const upPivot = Math.floor((this.maxRev - this.pivot) / 2) + this.pivot;
      this.minRev = this.pivot;
      if (upPivot !== this.maxRev && upPivot !== this.pivot) {
        this.pivot = upPivot;
      } else {
        isBisectOver = true;
      }
    } else {
      const downPivot = Math.floor((this.pivot - this.minRev) / 2) + this.minRev;
      this.maxRev = this.pivot;
      if (downPivot !== this.minRev && downPivot !== this.pivot) {
        this.pivot = downPivot;
      } else {
        isBisectOver = true;
      }
    }

    if (isBisectOver) {
      return [this.revList[this.minRev], this.revList[this.maxRev]];
    } else {
      return this.revList[this.pivot];
    }
  }

  private calculatePivot() {
    this.pivot = Math.floor((this.maxRev - this.minRev) / 2);
  }
}
