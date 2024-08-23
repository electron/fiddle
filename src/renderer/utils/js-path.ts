/**
 * Returns the value of an object's property at a given path.
 */
export function getAtPath(input: string, obj: any): any {
  return input.split('.').reduce((o, s) => o[s], obj);
}

/**
 * Sets a value of a property of an object at a given path
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
