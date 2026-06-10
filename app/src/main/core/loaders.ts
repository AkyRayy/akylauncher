import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { dirs } from './paths';
import { downloadAll, fetchJson, type FileTask } from './download';
import { mavenToPath } from './rules';
import type { LoaderKind } from '@shared/types';

const FabricLoaderListSchema = z.array(
  z.object({ loader: z.object({ version: z.string(), stable: z.boolean().optional() }) })
);

const LoaderProfileSchema = z.object({
  id: z.string(),
  inheritsFrom: z.string().optional(),
  mainClass: z.string(),
  libraries: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().optional(),
        sha1: z.string().optional()
      })
    )
    .default([])
});

const META: Record<'fabric' | 'quilt', { meta: string; maven: string }> = {
  fabric: { meta: 'https://meta.fabricmc.net/v2', maven: 'https://maven.fabricmc.net' },
  quilt: { meta: 'https://meta.quiltmc.org/v3', maven: 'https://maven.quiltmc.org/repository/release' }
};

export async function listLoaderVersions(kind: 'fabric' | 'quilt', mcVersion: string): Promise<string[]> {
  const { meta } = META[kind];
  const raw = await fetchJson(`${meta}/versions/loader/${encodeURIComponent(mcVersion)}`);
  return FabricLoaderListSchema.parse(raw).map((l) => l.loader.version);
}

export async function installFabricLike(kind: 'fabric' | 'quilt', mcVersion: string): Promise<string> {
  const { meta, maven } = META[kind];

  const loadersRaw = await fetchJson(`${meta}/versions/loader/${encodeURIComponent(mcVersion)}`);
  const loaders = FabricLoaderListSchema.parse(loadersRaw);
  if (loaders.length === 0) {
    throw new Error(`${kind}: нет лоадера под ${mcVersion} · проверь, что версия поддерживается`);
  }
  const stable = loaders.find((l) => l.loader.stable !== false) ?? loaders[0]!;
  const loaderVersion = stable.loader.version;

  const profileRaw = await fetchJson(
    `${meta}/versions/loader/${encodeURIComponent(mcVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`
  );
  const profile = LoaderProfileSchema.parse(profileRaw);

  const vdir = dirs.versionDir(profile.id);
  await mkdir(vdir, { recursive: true });
  await writeFile(join(vdir, `${profile.id}.json`), JSON.stringify(profileRaw, null, 2));

  const tasks: FileTask[] = [];
  for (const lib of profile.libraries) {
    let rel: string;
    try {
      rel = mavenToPath(lib.name);
    } catch {
      continue;
    }
    const base = (lib.url ?? maven).replace(/\/$/, '');
    tasks.push({
      url: `${base}/${rel}`,
      dest: join(dirs.libraries(), rel),
      sha1: lib.sha1
    });
  }
  await downloadAll(tasks, 8);

  return profile.id;
}

export function supportsAutoInstall(kind: LoaderKind): boolean {
  return kind === 'fabric' || kind === 'quilt' || kind === 'vanilla';
}
