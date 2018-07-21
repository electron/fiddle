import { classNames } from '../../src/utils/classnames';

describe('classnames', () => {
  it('correctly combines strings', () => {
    expect(classNames('red', 'blue')).toEqual('red blue');
  });

  it('correctly combines strings and numbers', () => {
    expect(classNames('red', 2)).toEqual('red 2');
  });

  it('correctly combines and arrays of string', () => {
    const input = [ 'red', [ 'blue', 'green' ] ];
    const output = 'red blue green';
    expect(classNames(input)).toEqual(output);
  });

  it('correctly parses objects', () => {
    const input = [ 'red', { blue: true, green: false } ];
    const output = 'red blue';
    expect(classNames(input)).toEqual(output);
  });

  it('correctly handles nothing', () => {
    expect(classNames()).toEqual('');
    expect(classNames(null, undefined, false)).toEqual('');
  });
});
