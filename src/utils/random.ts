/**
 * Dumb helper: Get a random number between two numbers
 *
 * @param {number} [min=0]
 * @param {number} [max=1]
 * @returns {number}
 */
export function getRandomNumber(
  min: number = 0, max: number = 1
): number {
  return Math.floor(Math.random() * max) + min;
}
