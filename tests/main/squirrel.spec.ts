/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { shouldQuit } from '../../src/main/squirrel';
import { mockRequire } from '../utils';

mockRequire('electron-squirrel-startup', { mock: true });

describe('shouldQuit', () => {
  it('returns simply electron-squirrel-startup', () => {
    expect(shouldQuit()).toEqual({ mock: true });
  });
});
