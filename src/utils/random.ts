/**
 * Dumb helper: Get a random number between two numbers
 *
 * @param {number} [min=0]
 * @param {number} [max=1]
 * @returns {number}
 */
export function getRandomNumber(min = 0, max = 1): number {
  return Math.floor(Math.random() * max) + min;
}
