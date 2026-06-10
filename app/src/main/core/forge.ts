import { join } from 'node:path';
import { mkdir, readdir, writeFile, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import { dirs } from './paths';
import { downloadAll, fetchJson, USER_AGENT } from './download';

const execFileAsync = promisify(execFile);

const PromosSchema = z.object({ promos: z.record(z.string()) });

export function pickForgeVersion(promos: Record<string, string>, mcVersion: string): string | null {
  return promos[`${mcVersion}-recommended`] ?? promos[`${mcVersion}-latest`] ?? null;
}

export function parseMavenVersions(xml: string): string[] {
  return [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1]!);
}

export function pickNeoforgeVersion(versions: string[], mcVersion: string): string | null {
  const m = mcVersion.match(/^1\.(\d+)(?:\.(\d+))?$/);
  if (!m) return null;
  const prefix = `${m[1]}.${m[2] ?? '0'}.`;
  const stable = versions.filter((v) => v.startsWith(prefix) && !v.includes('beta'));
  const pool = stable.length ? stable : versions.filter((v) => v.startsWith(prefix));
  return pool.length ? pool[pool.length - 1]! : null;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`http ${res.status} ${url}`);
  return res.text();
}

export async function installForgeLike(
  kind: 'forge' | 'neoforge',
  mcVersion: string,
  javaPath: string,
  onLog: (text: string) => void
): Promise<string> {
  let installerUrl: string;
  if (kind === 'forge') {
    const promos = PromosSchema.parse(
      await fetchJson('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json')
    ).promos;
    const ver = pickForgeVersion(promos, mcVersion);
    if (!ver) throw new Error(`forge: нет сборки под ${mcVersion}`);
    const full = `${mcVersion}-${ver}`;
    installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${full}/forge-${full}-installer.jar`;
  } else {
    const xml = await fetchText(
      'https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml'
    );
    const ver = pickNeoforgeVersion(parseMavenVersions(xml), mcVersion);
    if (!ver) throw new Error(`neoforge: нет сборки под ${mcVersion}`);
    installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${ver}/neoforge-${ver}-installer.jar`;
  }

  const root = dirs.root();
  await mkdir(dirs.versions(), { recursive: true });
  const profilesFile = join(root, 'launcher_profiles.json');
  try {
    await access(profilesFile);
  } catch {
    await writeFile(profilesFile, JSON.stringify({ profiles: {} }));
  }

  const installer = join(root, `${kind}-installer-${mcVersion}.jar`);
  onLog(`${kind} · скачиваю installer`);
  await downloadAll([{ url: installerUrl, dest: installer }]);

  const before = new Set(await readdir(dirs.versions()).catch(() => [] as string[]));
  onLog(`${kind} · запускаю installer · это может занять пару минут`);
  try {
    await execFileAsync(javaPath, ['-jar', installer, '--installClient', root], {
      timeout: 10 * 60_000,
      maxBuffer: 32 * 1024 * 1024
    });
  } catch (err) {
    throw new Error(`${kind} installer · ${String((err as Error).message).slice(0, 300)}`);
  }

  const after = await readdir(dirs.versions());
  const created = after.find((d) => !before.has(d) && d !== mcVersion);
  if (!created) throw new Error(`${kind} installer не создал версию`);
  onLog(`${kind} · версия ${created} готова`);
  return created;
}
