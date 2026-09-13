/**
 * Auto bisect (§17.9) without a window, shared by `BisectService` and the
 * headless CLI: both ends are verified first, then a binary search runs
 * `check` on each version. `check` resolves true for good, false for bad, and
 * undefined to stop (an invalid run, or the user stopped the bisect).
 * No Electron imports.
 */
import { Bisector } from '../../fiddle/bisect';

type AutoBisectResult =
  | { good: string; bad: string }
  /** `unexpected` is an end that didn't give the expected result. */
  | { stopped: true; unexpected?: string };

export async function autoBisect(
  range: readonly string[],
  check: (version: string) => Promise<boolean | undefined>,
): Promise<AutoBisectResult> {
  const first = range[0]!;
  const last = range[range.length - 1]!;
  const firstGood = await check(first);
  if (firstGood !== true) return firstGood === false ? { stopped: true, unexpected: first } : { stopped: true };
  const lastGood = await check(last);
  if (lastGood !== false) return lastGood === true ? { stopped: true, unexpected: last } : { stopped: true };

  const bisector = new Bisector(range);
  let step = bisector.current();
  while (!step.done) {
    const good = await check(step.version);
    if (good === undefined) return { stopped: true };
    step = good ? bisector.good() : bisector.bad();
  }
  return { good: step.good, bad: step.bad };
}
