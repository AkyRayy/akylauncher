import { describe, expect, it } from 'vitest';
import { parseMavenVersions, pickForgeVersion, pickNeoforgeVersion } from '../forge';
import { crc32 } from '../zip';
import { elyJvmArgs } from '../authlib';

describe('pickForgeVersion', () => {
  const promos = {
    '1.20.1-recommended': '47.2.0',
    '1.20.1-latest': '47.3.1',
    '1.21.4-latest': '54.1.0'
  };
  it('recommended приоритетнее latest', () => {
    expect(pickForgeVersion(promos, '1.20.1')).toBe('47.2.0');
  });
  it('фолбэк на latest', () => {
    expect(pickForgeVersion(promos, '1.21.4')).toBe('54.1.0');
  });
  it('нет сборки → null', () => {
    expect(pickForgeVersion(promos, '1.8.9')).toBeNull();
  });
});

describe('pickNeoforgeVersion', () => {
  const versions = ['20.4.237', '21.1.80', '21.1.95', '21.4.50-beta', '21.4.124'];
  it('последняя стабильная под мажор.минор', () => {
    expect(pickNeoforgeVersion(versions, '1.21.1')).toBe('21.1.95');
  });
  it('beta отфильтрована, если есть стабильная', () => {
    expect(pickNeoforgeVersion(versions, '1.21.4')).toBe('21.4.124');
  });
  it('1.20.4 → 20.4.x', () => {
    expect(pickNeoforgeVersion(versions, '1.20.4')).toBe('20.4.237');
  });
  it('нет сборки → null', () => {
    expect(pickNeoforgeVersion(versions, '1.19.2')).toBeNull();
  });
});

describe('parseMavenVersions', () => {
  it('вытаскивает версии из maven-metadata.xml', () => {
    const xml = '<metadata><versioning><versions><version>21.1.80</version><version>21.4.124</version></versions></versioning></metadata>';
    expect(parseMavenVersions(xml)).toEqual(['21.1.80', '21.4.124']);
  });
});

describe('crc32', () => {
  it('эталонные значения', () => {
    expect(crc32(Buffer.from(''))).toBe(0);
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
  });
});

describe('elyJvmArgs', () => {
  it('javaagent с ely.by', () => {
    const args = elyJvmArgs('/path/authlib-injector.jar');
    expect(args[0]).toBe('-javaagent:/path/authlib-injector.jar=ely.by');
    expect(args).toContain('-Dauthlibinjector.side=client');
  });
});
