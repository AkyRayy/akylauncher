import { describe, expect, it } from 'vitest';
import { isNewer, parseSemver } from '../updater';

describe('parseSemver', () => {
  it('v-префикс и суффиксы', () => {
    expect(parseSemver('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseSemver('1.0.0-beta')).toEqual([1, 0, 0]);
    expect(parseSemver('v2.1')).toEqual([2, 1, 0]);
  });
  it('мусор → нули', () => {
    expect(parseSemver('latest')).toEqual([0, 0, 0]);
  });
});

describe('isNewer', () => {
  it('новее по мажору/минору/патчу', () => {
    expect(isNewer('v1.1.0', '1.0.0-beta')).toBe(true);
    expect(isNewer('v1.0.1', '1.0.0-beta')).toBe(true);
    expect(isNewer('v2.0.0', '1.9.9')).toBe(true);
  });
  it('та же или старее — не новее', () => {
    expect(isNewer('v1.0.0', '1.0.0-beta')).toBe(false);
    expect(isNewer('v0.9.0', '1.0.0-beta')).toBe(false);
  });
});
