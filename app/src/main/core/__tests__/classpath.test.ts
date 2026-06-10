import { describe, expect, it } from 'vitest';
import { dedupeLibraries, libraryRelPath } from '../rules';
import type { Library } from '../mojang-schemas';

describe('libraryRelPath', () => {
  it('mojang-либа: путь из downloads.artifact.path', () => {
    const lib: Library = {
      name: 'com.mojang:datafixerupper:8.0.16',
      downloads: {
        artifact: {
          path: 'com/mojang/datafixerupper/8.0.16/datafixerupper-8.0.16.jar',
          sha1: 'x'.repeat(40), size: 1, url: 'https://libraries.minecraft.net/x.jar'
        }
      }
    };
    expect(libraryRelPath(lib)).toBe('com/mojang/datafixerupper/8.0.16/datafixerupper-8.0.16.jar');
  });

  it('fabric-либа без downloads: путь из maven-имени (раньше выпадала из classpath)', () => {
    const lib: Library = { name: 'net.fabricmc:fabric-loader:0.16.10' };
    expect(libraryRelPath(lib)).toBe('net/fabricmc/fabric-loader/0.16.10/fabric-loader-0.16.10.jar');
  });

  it('natives-only запись в classpath не идёт', () => {
    const lib: Library = {
      name: 'org.lwjgl:lwjgl:3.3.3',
      downloads: {
        classifiers: {
          'natives-windows': {
            path: 'org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar',
            sha1: 'y'.repeat(40), size: 1, url: 'https://example.com/n.jar'
          }
        }
      }
    };
    expect(libraryRelPath(lib)).toBeNull();
  });
});

describe('dedupeLibraries', () => {
  it('при дубле артефакта побеждает первый (либы лоадера идут первыми после merge)', () => {
    const libs: Library[] = [
      { name: 'org.ow2.asm:asm:9.7.1' },
      { name: 'org.ow2.asm:asm:9.3' },
      { name: 'net.fabricmc:fabric-loader:0.16.10' }
    ];
    const out = dedupeLibraries(libs);
    expect(out.map((l) => l.name)).toEqual([
      'org.ow2.asm:asm:9.7.1',
      'net.fabricmc:fabric-loader:0.16.10'
    ]);
  });

  it('разные classifiers одного артефакта не считаются дублем', () => {
    const libs: Library[] = [
      { name: 'org.lwjgl:lwjgl:3.3.3' },
      { name: 'org.lwjgl:lwjgl:3.3.3:natives-windows' }
    ];
    expect(dedupeLibraries(libs)).toHaveLength(2);
  });
});
