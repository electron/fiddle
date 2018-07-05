export function classNames(...args: Array<any>) {
  const classes: Array<string> = [];

  for (const arg of args) {
    if (!arg) continue;

    if (typeof arg === 'string' || typeof arg === 'number') {
      classes.push(arg.toString());
    } else if (Array.isArray(arg) && arg.length) {
      const inner = classNames.apply(null, arg);

      if (inner) {
        classes.push(inner);
      }
    } else if (typeof arg === 'object') {
      for (const key in arg) {
        if ({}.hasOwnProperty.call(arg, key) && arg[key]) {
          classes.push(key);
        }
      }
    }
  }

  return classes.join(' ');
}
