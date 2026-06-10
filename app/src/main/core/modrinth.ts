import { join } from 'node:path';
import { readdir, rm } from 'node:fs/promises';
import { z } from 'zod';
import { dirs } from './paths';
import { downloadAll, fetchJson } from './download';
import { listInstances, updateInstance } from './instances';
import type { LoaderKind, ModSort, ModrinthSearchResult } from '@shared/types';

const API = 'https://api.modrinth.com/v2';

const SearchSchema = z.object({
  hits: z.array(
    z.object({
      project_id: z.string(),
      slug: z.string(),
      title: z.string(),
      description: z.string(),
      downloads: z.number(),
      follows: z.number(),
      categories: z.array(z.string()).optional(),
      icon_url: z.string().nullable().optional()
    })
  ),
  total_hits: z.number()
});

const VersionsSchema = z.array(
  z.object({
    id: z.string(),
    version_number: z.string().optional(),
    date_published: z.string().optional(),
    game_versions: z.array(z.string()),
    loaders: z.array(z.string()),
    files: z.array(
      z.object({
        url: z.string().url(),
        filename: z.string(),
        primary: z.boolean(),
        hashes: z.object({ sha1: z.string().optional() }).optional(),
        size: z.number().optional()
      })
    )
  })
);

const SORT_INDEX: Record<ModSort, string> = {
  relevance: 'relevance',
  downloads: 'downloads',
  newest: 'newest',
  updated: 'updated'
};

export async function searchMods(
  query: string,
  mcVersion: string,
  loader: LoaderKind,
  offset = 0,
  sort: ModSort = 'relevance'
): Promise<ModrinthSearchResult> {
  const facets = [
    ['project_type:mod'],
    [`versions:${mcVersion}`],
    ...(loader !== 'vanilla' ? [[`categories:${loader}`]] : [])
  ];
  const url = `${API}/search?query=${encodeURIComponent(query)}&offset=${offset}&limit=20&index=${SORT_INDEX[sort]}&facets=${encodeURIComponent(JSON.stringify(facets))}`;
  const parsed = SearchSchema.parse(await fetchJson(url));
  return {
    totalHits: parsed.total_hits,
    hits: parsed.hits.map((h) => ({
      projectId: h.project_id,
      slug: h.slug,
      title: h.title,
      description: h.description,
      downloads: h.downloads,
      follows: h.follows,
      categories: (h.categories ?? []).filter((c) => !['fabric', 'forge', 'quilt', 'neoforge'].includes(c)),
      iconUrl: h.icon_url ?? null
    }))
  };
}

export async function countMods(instanceId: string): Promise<number> {
  try {
    const files = await readdir(join(dirs.instanceDir(instanceId), 'mods'));
    return files.filter((f) => f.endsWith('.jar')).length;
  } catch {
    return 0;
  }
}

export async function listModFiles(instanceId: string): Promise<string[]> {
  try {
    const files = await readdir(join(dirs.instanceDir(instanceId), 'mods'));
    return files.filter((f) => f.endsWith('.jar')).sort();
  } catch {
    return [];
  }
}

export async function deleteModFile(instanceId: string, filename: string): Promise<void> {
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw new Error('некорректное имя файла');
  }
  await rm(join(dirs.instanceDir(instanceId), 'mods', filename));
  const inst = (await listInstances()).find((i) => i.id === instanceId);
  if (inst) await updateInstance(instanceId, { modsCount: await countMods(instanceId) });
}

export async function installMod(projectId: string, instanceId: string): Promise<void> {
  const inst = (await listInstances()).find((i) => i.id === instanceId);
  if (!inst) throw new Error('профиль не найден');
  if (inst.loader === 'vanilla') throw new Error('vanilla не поддерживает моды · выбери fabric/forge');

  const url = `${API}/project/${projectId}/version?game_versions=${encodeURIComponent(JSON.stringify([inst.mcVersion]))}&loaders=${encodeURIComponent(JSON.stringify([inst.loader]))}`;
  const versions = VersionsSchema.parse(await fetchJson(url));
  if (versions.length === 0) {
    throw new Error(`нет сборки под ${inst.mcVersion} · ${inst.loader}`);
  }
  const version = [...versions].sort((a, b) =>
    (b.date_published ?? '').localeCompare(a.date_published ?? '')
  )[0]!;

  const file = version.files.find((f) => f.primary) ?? version.files[0];
  if (!file) throw new Error('у версии мода нет файлов');

  await downloadAll([
    {
      url: file.url,
      dest: join(dirs.instanceDir(instanceId), 'mods', file.filename),
      sha1: file.hashes?.sha1,
      size: file.size
    }
  ]);
  await updateInstance(instanceId, { modsCount: await countMods(instanceId) });
}
