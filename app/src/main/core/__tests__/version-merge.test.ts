import { describe, expect, it } from 'vitest';
import { mergeVersionJson } from '../version-merge';
import type { VersionJson } from '../mojang-schemas';

const parent: VersionJson = {
  id: '1.21.4',
  type: 'release',
  mainClass: 'net.minecraft.client.main.Main',
  assets: '17',
  assetIndex: { id: '17', url: 'https://example.com/17.json', sha1: 'a'.repeat(40) },
  downloads: { client: { sha1: 'b'.repeat(40), size: 1, url: 'https://example.com/client.jar' } },
  libraries: [{ name: 'com.mojang:base:1.0' }],
  arguments: { game: ['--username', '${auth_player_name}'], jvm: ['-cp', '${classpath}'] },
  javaVersion: { majorVersion: 21 }
};

const child: VersionJson = {
  id: 'fabric-loader-0.16.10-1.21.4',
  type: 'release',
  mainClass: 'net.fabricmc.loader.impl.launch.knot.KnotClient',
  libraries: [{ name: 'net.fabricmc:fabric-loader:0.16.10' }],
  arguments: { game: [], jvm: ['-DFabricMcEmu=net.minecraft.client.main.Main'] },
  inheritsFrom: '1.21.4'
};

describe('mergeVersionJson', () => {
  const merged = mergeVersionJson(parent, child);

  it('mainClass — от ребёнка (лоадера)', () => {
    expect(merged.mainClass).toBe('net.fabricmc.loader.impl.launch.knot.KnotClient');
  });

  it('downloads и assetIndex — от родителя', () => {
    expect(merged.downloads?.client.url).toBe('https://example.com/client.jar');
    expect(merged.assetIndex?.id).toBe('17');
  });

  it('библиотеки: лоадер первым, родитель следом', () => {
    expect(merged.libraries.map((l) => l.name)).toEqual([
      'net.fabricmc:fabric-loader:0.16.10',
      'com.mojang:base:1.0'
    ]);
  });

  it('аргументы конкатенируются: родительские + детские', () => {
    expect(merged.arguments?.game).toEqual(['--username', '${auth_player_name}']);
    expect(merged.arguments?.jvm).toEqual(['-cp', '${classpath}', '-DFabricMcEmu=net.minecraft.client.main.Main']);
  });

  it('javaVersion наследуется, inheritsFrom очищается', () => {
    expect(merged.javaVersion?.majorVersion).toBe(21);
    expect(merged.inheritsFrom).toBeUndefined();
  });
});
