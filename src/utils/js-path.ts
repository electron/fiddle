/**
 * Returns the value of an object's property at a given path.
 *
 * @param {string} input
 * @param {*} obj
 * @returns {any}
 */
export function getAtPath(input: string, obj: any): any {
  return input
    .split('.')
    .reduce((o, s) => o[s], obj);
}

/**
 * Sets a value of a property of an object at a given path
 *
 * @param {string} input
 * @param {*} obj
 * @param {*} val
 */
export function setAtPath(input: string, obj: any, val: any) {
  const pathValues = input.split('.');

  pathValues.reduce((o, s, i) => {
    if (i !== pathValues.length - 1) {
      return o[s];
    }

    o[s] = val;
  }, obj);
}
