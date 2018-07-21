/**
 * On Windows, the "Cancel" button is on the right. On macOS, it's on
 * the left. This method takes an array of buttons, expects the "Cancel"
 * button to be the first one, and sorts them accordingly.
 *
 * @export
 * @param {Array<JSX.Element>} input
 * @returns {Array<JSX.Element>}
 */
export function sortButtons(input: Array<JSX.Element>): Array<JSX.Element> {
  let output = input;

  if (input.length > 1 && process.platform === 'darwin') {
    output = input.slice(1, input.length);
    output.push(input[0]);
  }

  return output;
}
