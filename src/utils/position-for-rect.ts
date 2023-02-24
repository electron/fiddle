import { ArrowPosition } from '../interfaces';

interface PositionResult {
  top: number;
  left: number;
  type: ArrowPosition;
}

/**
 * This method takes a ClientRect and returns a solid
 * position for, say, a dialog, tooltip, or popover.
 *
 * TODO: Make this a lot smarter!
 *
 * @param {ClientRect} target
 * @param {number} margin
 * @param {{ width: number, height: number }} size
 * @returns {PositionResult}
 */
export function positionForRect(
  target: ClientRect,
  size: { width: number; height: number },
  margin = 10,
): PositionResult {
  const result: PositionResult = { left: 0, top: 0, type: 'top' };
  const middle = target.left + target.width / 2 - size.width / 2;
  const darwinTop =
    window.ElectronFiddle.platform === 'darwin' ? margin * 1.5 : 0;
  const topPlusMargin = target.top - darwinTop;

  // Okay, let's try top right
  result.left = target.left + target.width + margin;
  result.top = topPlusMargin;

  if (isResultOkay(result, size)) {
    return { ...result, type: 'right' };
  }

  // Okay, let's try top left
  result.left = target.left - margin - size.width;
  result.top = topPlusMargin;

  if (isResultOkay(result, size)) {
    return { ...result, type: 'left' };
  }

  // Okay, let's try bottom middle
  result.left = middle;
  result.top = target.top + target.height + margin;

  if (isResultOkay(result, size)) {
    return { ...result, type: 'bottom' };
  }

  // Top middle would require us to measure the
  // text height, which is a bit gross. I'll leave
  // this commented out for now, but if you need it
  // you can enable it.
  // -----------------------------------------------
  // result.left = middle;
  // result.top = target.top - size.height - margin;

  // if (isResultOkay(result, size)) {
  //   return { ...result, type: 'top' };
  // }
  // -----------------------------------------------

  // Alright, smack in the middle it is
  result.left = middle;
  result.top = target.top + size.height - margin;

  return { ...result, type: 'bottom' };
}

function isResultOkay(
  input: PositionResult,
  size: { width: number; height: number },
): boolean {
  return (
    !isTooFarRight(input, size) &&
    !isTooFarLeft(input) &&
    !isTooFarUp(input) &&
    !isTooFarBelow(input, size)
  );
}

/**
 * Is the position too far up?
 *
 * @param {PositionResult} input
 * @returns {boolean}
 */
function isTooFarUp(input: PositionResult): boolean {
  return input.top < 0;
}

/**
 * Is the position too far below?
 *
 * @param {PositionResult} input
 * @param {{ width: number, height: number }} size
 * @returns {boolean}
 */
function isTooFarBelow(
  input: PositionResult,
  size: { width: number; height: number },
): boolean {
  const { innerHeight } = window;
  const tolerance = size.height * 0.3;

  return input.top + size.height > innerHeight + tolerance;
}

/**
 * Is the position too far right?
 *
 * @param {PositionResult} input
 * @param {{ width: number, height: number }} size
 * @returns {boolean}
 */
function isTooFarRight(
  input: PositionResult,
  size: { width: number; height: number },
): boolean {
  const { innerWidth } = window;
  const tolerance = size.width * 0.3;

  return input.left + size.width > innerWidth + tolerance;
}

/**
 * Is the position too far left?
 *
 * @param {PositionResult} input
 * @returns {boolean}
 */
function isTooFarLeft(input: PositionResult): boolean {
  return input.left < 0;
}
