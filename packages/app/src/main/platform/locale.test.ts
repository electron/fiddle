import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: {} }));
vi.mock('../test-mode', () => ({ isTestMode: () => false }));

import { localeSettingFrom } from './locale';

describe('localeSettingFrom', () => {
  it('reads a chosen language and ignores the system default and invalid values', () => {
    expect(localeSettingFrom({ locale: 'de' })).toBe('de');
    expect(localeSettingFrom({ locale: 'pt-BR' })).toBe('pt-BR');
    expect(localeSettingFrom({ locale: 'system' })).toBeUndefined();
    expect(localeSettingFrom({ locale: 3 })).toBeUndefined();
    expect(localeSettingFrom({ locale: 'not a language' })).toBeUndefined();
    expect(localeSettingFrom({})).toBeUndefined();
    expect(localeSettingFrom(undefined)).toBeUndefined();
  });
});
