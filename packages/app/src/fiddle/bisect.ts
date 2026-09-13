import { ErrorCode, FiddleError } from '../shared/errors';

export type BisectStep =
  | { done: false; version: string }
  /** `good` is the last good version, `bad` the first bad one. */
  | { done: true; good: string; bad: string };

/**
 * Manual bisect over versions ordered oldest → newest. The first is known
 * good and the last known bad; each step tests a version strictly between.
 */
export class Bisector {
  private lo = 0;
  private hi: number;
  private pivot = -1;
  private readonly skipped = new Set<number>();
  private step: BisectStep;

  constructor(
    private readonly versions: readonly string[],
    private readonly random: () => number = Math.random,
  ) {
    if (versions.length < 2) {
      throw new FiddleError(ErrorCode.invalidArgument, 'Bisect needs at least two versions');
    }
    this.hi = versions.length - 1;
    this.step = this.next();
  }

  current(): BisectStep {
    return this.step;
  }

  good(): BisectStep {
    if (this.step.done) return this.step;
    this.lo = this.pivot;
    return (this.step = this.next());
  }

  bad(): BisectStep {
    if (this.step.done) return this.step;
    this.hi = this.pivot;
    return (this.step = this.next());
  }

  /** Skips the current version for a random one in range, weighted towards older versions. */
  skip(): BisectStep {
    if (this.step.done) return this.step;
    this.skipped.add(this.pivot);
    const candidates = this.candidates();
    if (candidates.length === 0) return (this.step = this.finish());
    this.pivot = candidates[Math.min(candidates.length - 1, Math.floor(this.random() ** 1.5 * candidates.length))]!;
    return (this.step = { done: false, version: this.versions[this.pivot]! });
  }

  private candidates(): number[] {
    const result: number[] = [];
    for (let i = this.lo + 1; i < this.hi; i++) if (!this.skipped.has(i)) result.push(i);
    return result;
  }

  private next(): BisectStep {
    const candidates = this.candidates();
    if (candidates.length === 0) return this.finish();
    const mid = (this.lo + this.hi) / 2;
    this.pivot = candidates.reduce((best, i) => (Math.abs(i - mid) < Math.abs(best - mid) ? i : best));
    return { done: false, version: this.versions[this.pivot]! };
  }

  private finish(): BisectStep {
    return { done: true, good: this.versions[this.lo]!, bad: this.versions[this.hi]! };
  }
}

export function bisectCompareUrl(good: string, bad: string): string {
  return `https://github.com/electron/electron/compare/v${good}...v${bad}`;
}
