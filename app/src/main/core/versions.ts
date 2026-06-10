import { join } from 'node:path';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirs } from './paths';
import { downloadAll, fetchJson, type FileTask } from './download';
import {
  AssetIndexSchema,
  VersionJsonSchema,
  VersionManifestSchema,
  type VersionJson
} from './mojang-schemas';
import { currentOs, filterLibraries } from './rules';
import { mergeVersionJson } from './version-merge';
import type { DownloadProgress, VersionSummary } from '@shared/types';

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const ASSETS_BASE = 'https://resources.download.minecraft.net';

let manifestCache: { fetchedAt: number; data: VersionSummary[] } | null = null;

export async function isVersionInstalled(id: string, requireJar = true): Promise<boolean> {
  try {
    await access(join(dirs.versionDir(id), `${id}.json`));
    if (requireJar) await access(join(dirs.versionDir(id), `${id}.jar`));
    return true;
  } catch {
    return false;
  }
}

const isInstalled = (id: string) => isVersionInstalled(id);

export async function listVersions(force = false): Promise<VersionSummary[]> {
  if (!force && manifestCache && Date.now() - manifestCache.fetchedAt < 10 * 60_000) {
    return manifestCache.data;
  }
  const raw = await fetchJson(MANIFEST_URL);
  const manifest = VersionManifestSchema.parse(raw);
  const data: VersionSummary[] = [];
  for (const v of manifest.versions) {
    data.push({
      id: v.id,
      kind: v.type,
      url: v.url,
      releaseTime: v.releaseTime,
      installed: await isInstalled(v.id)
    });
  }
  manifestCache = { fetchedAt: Date.now(), data };
  return data;
}

export async function readVersionJson(id: string): Promise<VersionJson> {
  const raw = JSON.parse(await readFile(join(dirs.versionDir(id), `${id}.json`), 'utf8'));
  return VersionJsonSchema.parse(raw);
}

export async function resolveVersionJson(id: string, depth = 0): Promise<VersionJson> {
  if (depth > 4) throw new Error(`inheritsFrom: цикл или слишком глубокая цепочка у ${id}`);
  const child = await readVersionJson(id);
  if (!child.inheritsFrom) return child;
  const parent = await resolveVersionJson(child.inheritsFrom, depth + 1);
  return mergeVersionJson(parent, child);
}

export async function installVersion(
  versionId: string,
  onProgress: (p: DownloadProgress) => void
): Promise<void> {
  const taskId = `install-${versionId}-${Date.now()}`;
  const emit = (patch: Partial<DownloadProgress>) =>
    onProgress({
      taskId,
      label: versionId,
      ratio: 0,
      done: 0,
      total: 0,
      speedBps: 0,
      phase: 'manifest',
      message: '',
      ...patch
    });

  try {
    emit({ phase: 'manifest', message: 'fetching manifest' });
    const versions = await listVersions();
    const entry = versions.find((v) => v.id === versionId);
    if (!entry) throw new Error(`unknown version ${versionId}`);

    const vjson = VersionJsonSchema.parse(await fetchJson(entry.url));
    const vdir = dirs.versionDir(versionId);
    await mkdir(vdir, { recursive: true });
    await writeFile(join(vdir, `${versionId}.json`), JSON.stringify(vjson, null, 2));

    if (vjson.downloads?.client) {
      emit({ phase: 'client', message: 'downloading client.jar', ratio: 0.05 });
      await downloadAll([
        {
          url: vjson.downloads.client.url,
          dest: join(vdir, `${versionId}.jar`),
          sha1: vjson.downloads.client.sha1,
          size: vjson.downloads.client.size
        }
      ]);
    }

    const os = currentOs();
    const libs = filterLibraries(vjson.libraries, os);
    const libTasks: FileTask[] = [];
    for (const lib of libs) {
      const art = lib.downloads?.artifact;
      if (art) {
        libTasks.push({
          url: art.url,
          dest: join(dirs.libraries(), art.path),
          sha1: art.sha1,
          size: art.size
        });
      }
      const nativeKey = lib.natives?.[os.name];
      if (nativeKey && lib.downloads?.classifiers) {
        const cls = lib.downloads.classifiers[nativeKey.replace('${arch}', os.arch === 'x64' ? '64' : '32')];
        if (cls) {
          libTasks.push({
            url: cls.url,
            dest: join(dirs.libraries(), cls.path),
            sha1: cls.sha1,
            size: cls.size
          });
        }
      }
    }
    const t0 = Date.now();
    await downloadAll(libTasks, 8, ({ done, total, bytes }) =>
      emit({
        phase: 'libraries',
        message: `libraries ${done}/${total}`,
        done,
        total,
        ratio: 0.1 + 0.3 * (done / Math.max(total, 1)),
        speedBps: (bytes / Math.max(Date.now() - t0, 1)) * 1000
      })
    );

    if (vjson.assetIndex) {
      const idxRaw = await fetchJson(vjson.assetIndex.url);
      const idx = AssetIndexSchema.parse(idxRaw);
      const idxDir = join(dirs.assets(), 'indexes');
      await mkdir(idxDir, { recursive: true });
      await writeFile(join(idxDir, `${vjson.assetIndex.id}.json`), JSON.stringify(idxRaw));

      const assetTasks: FileTask[] = Object.values(idx.objects).map((obj) => ({
        url: `${ASSETS_BASE}/${obj.hash.slice(0, 2)}/${obj.hash}`,
        dest: join(dirs.assets(), 'objects', obj.hash.slice(0, 2), obj.hash),
        sha1: obj.hash,
        size: obj.size
      }));
      const t1 = Date.now();
      await downloadAll(assetTasks, 8, ({ done, total, bytes }) =>
        emit({
          phase: 'assets',
          message: `fetching assets ${done}/${total}`,
          done,
          total,
          ratio: 0.4 + 0.6 * (done / Math.max(total, 1)),
          speedBps: (bytes / Math.max(Date.now() - t1, 1)) * 1000
        })
      );
    }

    manifestCache = null;
    emit({ phase: 'done', ratio: 1, message: 'версия готова' });
  } catch (err) {
    emit({ phase: 'error', message: `загрузка прервана · ${(err as Error).message}` });
    throw err;
  }
}
