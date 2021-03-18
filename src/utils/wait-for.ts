/**
 * Waits up to `timeout` msec for a test to pass.
 *
 * @return a promise that returns the test result on success, or rejects on timeout
 * @param {() => any} test - function to test
 * @param {Number} [timeoutMsec=2000] - maximum time to wait
 * @param {Number} [intervalMsec=100] - how often to test
 */
export async function waitFor(
  test: () => any,
  options = {
    interval: 100,
    timeout: 2000,
  },
): Promise<any> {
  const { interval, timeout } = options;
  let elapsed = 0;
  return new Promise<void>((resolve, reject) => {
    (function check() {
      const result = test();
      if (result) {
        return resolve(result);
      }
      elapsed += interval;
      if (elapsed >= timeout) {
        return reject(`Timed out: ${timeout}ms`);
      }
      setTimeout(check, interval);
    })();
  });
}
