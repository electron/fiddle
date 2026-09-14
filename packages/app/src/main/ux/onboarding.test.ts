import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { AppStateFile } from '../documents/service';
import { createJsonStore, flushAll } from '../persistence/json-store';
import { createOnboarding } from './onboarding';

let dir = '';

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fiddle-onboarding-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

/** state.json as Documents opens it, reduced to the keys onboarding uses. */
function load() {
  const store = createJsonStore<AppStateFile>({
    file: path.join(dir, 'state.json'),
    schema: z.looseObject({ tourDone: z.boolean().optional(), crashNoticeShown: z.boolean().optional() }),
    defaults: { sessions: [], recentFolders: [] },
    version: 1,
  });
  return createOnboarding(store);
}

describe('onboarding', () => {
  // @feature onboarding.tour onboarding.offer-repeat
  it('offers the tour once per launch until it is done', () => {
    const first = load();
    expect(first.shouldOfferTour()).toBe(true);
    expect(first.shouldOfferTour()).toBe(false);
    expect(load().shouldOfferTour()).toBe(true);
  });

  it('shows the crash reports notice once, ever, and keeps it with the tour in state.json', async () => {
    const first = load();
    expect(first.takeCrashReportsNotice(true)).toBe(true);
    expect(first.takeCrashReportsNotice(true)).toBe(false);
    first.setTourDone();
    await flushAll();

    const next = load();
    expect(next.takeCrashReportsNotice(true)).toBe(false);
    expect(next.shouldOfferTour()).toBe(false);
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'))).toMatchObject({
      tourDone: true,
      crashNoticeShown: true,
    });
  });

  it('does not show the notice while crash reports are off, and not later either', () => {
    const { takeCrashReportsNotice } = load();
    expect(takeCrashReportsNotice(false)).toBe(false);
    expect(takeCrashReportsNotice(true)).toBe(false);
  });
});
