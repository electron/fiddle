import { waitFor } from '../../src/utils/wait-for';

describe('waitFor()', () => {
  it('resolves when a condition is truthy', async () => {
    let number = 0;
    const test = () => number;
    setTimeout(() => {
      console.log('setting number to 1');
      number = 1;
    }, 10);
    const result = await waitFor(test);
    expect(result).toBe(number);
  });

  it('rejects if it takes too long', () => {
    const test = () => false;
    const opts = { interval: 10, timeout: 100 };
    expect(waitFor(test, opts)).rejects.toMatch('Timed out');
  });

  it(`honors the 'interval' option`, async () => {
    const MaxCalls = 5;
    const opts = { interval: 50, timeout: 2000 };

    let num_calls = 0;
    const test = () => ++num_calls === MaxCalls;

    const start_time = Date.now();
    await waitFor(test, opts);
    const msec_elapsed = Date.now() - start_time;

    expect(msec_elapsed).toBeGreaterThanOrEqual(opts.interval * (MaxCalls - 1));
    expect(msec_elapsed).toBeLessThanOrEqual(opts.interval * (MaxCalls + 1));
  });
});
