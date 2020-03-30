import { getRandomNumber } from './random';

/**
 * Get a random nice greeting
 *
 * @export
 * @returns
 */
export function getNiceGreeting() {
  const greetings = [
    '👋 Go build a great app',
    '💖 You got this',
    `💖 We think you're great`,
    '🤘 Your app will rock, we know it',
    '🙇‍♀️ Thanks for trying out Electron & Fiddle',
    '🐕 Go pet a dog today',
    '🐈 Go pet a cat today',
    '💧 Stay hydrated',
  ];

  const min = 0;
  const max = greetings.length;

  return greetings[getRandomNumber(min, max)];
}
