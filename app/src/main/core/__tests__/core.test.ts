import { describe, expect, it } from 'vitest';
import { rulesAllow, flattenArgs, substitute, mavenToPath, type OsInfo } from '../rules';
import { offlineUuid, validNickname } from '../auth';
import { parseJavaVersion } from '../java';

const win: OsInfo = { name: 'windows', arch: 'x64' };
const linux: OsInfo = { name: 'linux', arch: 'x64' };

describe('rulesAllow', () => {
  it('пустые rules = allow', () => {
    expect(rulesAllow(undefined, win)).toBe(true);
    expect(rulesAllow([], win)).toBe(true);
  });

  it('allow только для osx → windows запрещён', () => {
    const rules = [{ action: 'allow' as const, os: { name: 'osx' as const } }];
    expect(rulesAllow(rules, win)).toBe(false);
  });

  it('allow всем + disallow windows', () => {
    const rules = [
      { action: 'allow' as const },
      { action: 'disallow' as const, os: { name: 'windows' as const } }
    ];
    expect(rulesAllow(rules, win)).toBe(false);
    expect(rulesAllow(rules, linux)).toBe(true);
  });

  it('features: правило с is_demo_user не проходит по умолчанию', () => {
    const rules = [{ action: 'allow' as const, features: { is_demo_user: true } }];
    expect(rulesAllow(rules, win)).toBe(false);
    expect(rulesAllow(rules, win, { is_demo_user: true })).toBe(true);
  });
});

describe('flattenArgs', () => {
  it('строки проходят как есть, условные — по rules', () => {
    const args = [
      '--username',
      { rules: [{ action: 'allow' as const, os: { name: 'linux' as const } }], value: '-Dlinux=1' },
      { rules: [{ action: 'allow' as const }], value: ['-a', '-b'] }
    ];
    expect(flattenArgs(args, win)).toEqual(['--username', '-a', '-b']);
    expect(flattenArgs(args, linux)).toEqual(['--username', '-Dlinux=1', '-a', '-b']);
  });
});

describe('substitute', () => {
  it('подставляет переменные, неизвестные оставляет', () => {
    const out = substitute(['--name', '${auth_player_name}', '${unknown_var}'], {
      auth_player_name: 'AkyPlayer'
    });
    expect(out).toEqual(['--name', 'AkyPlayer', '${unknown_var}']);
  });
});

describe('mavenToPath', () => {
  it('group:artifact:version', () => {
    expect(mavenToPath('net.fabricmc:fabric-loader:0.16.10')).toBe(
      'net/fabricmc/fabric-loader/0.16.10/fabric-loader-0.16.10.jar'
    );
  });
  it('с classifier', () => {
    expect(mavenToPath('org.lwjgl:lwjgl:3.3.3:natives-windows')).toBe(
      'org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar'
    );
  });
});

describe('offlineUuid', () => {
  it('детерминированный и в формате uuid v3', () => {
    const a = offlineUuid('AkyPlayer');
    const b = offlineUuid('AkyPlayer');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('разные ники → разные uuid', () => {
    expect(offlineUuid('Steve')).not.toBe(offlineUuid('Alex'));
  });
});

describe('validNickname', () => {
  it('валидные', () => {
    expect(validNickname('Aky_123')).toBe(true);
    expect(validNickname('abc')).toBe(true);
  });
  it('невалидные', () => {
    expect(validNickname('ab')).toBe(false);
    expect(validNickname('слишком_русский')).toBe(false);
    expect(validNickname('a'.repeat(17))).toBe(false);
  });
});

describe('parseJavaVersion', () => {
  it('современный формат', () => {
    expect(parseJavaVersion('openjdk version "21.0.3" 2024-04-16')).toEqual({
      version: '21.0.3',
      major: 21
    });
  });
  it('legacy 1.8', () => {
    expect(parseJavaVersion('java version "1.8.0_402"')).toEqual({
      version: '1.8.0_402',
      major: 8
    });
  });
  it('мусор → null', () => {
    expect(parseJavaVersion('command not found')).toBeNull();
  });
});
