import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { mkdir, readdir, chmod } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { dirs } from './paths';
import type { JavaRuntime } from '@shared/types';

const execFileAsync = promisify(execFile);

export function parseJavaVersion(stderr: string): { version: string; major: number } | null {
  const m = stderr.match(/version "([^"]+)"/);
  if (!m || !m[1]) return null;
  const version = m[1];
  const major = version.startsWith('1.') ? Number(version.split('.')[1]) : Number(version.split('.')[0]);
  return Number.isFinite(major) ? { version, major } : null;
}

async function probe(path: string): Promise<JavaRuntime | null> {
  try {
    const { stderr } = await execFileAsync(path, ['-version'], { timeout: 10_000 });
    const parsed = parseJavaVersion(stderr);
    return parsed ? { path, ...parsed, source: 'system' } : null;
  } catch {
    return null;
  }
}

export async function listJava(): Promise<JavaRuntime[]> {
  const found: JavaRuntime[] = [];
  const candidates = new Set<string>();
  const exe = process.platform === 'win32' ? 'java.exe' : 'java';

  if (process.env.JAVA_HOME) candidates.add(join(process.env.JAVA_HOME, 'bin', exe));
  candidates.add(exe);

  try {
    for (const dir of await readdir(dirs.java())) {
      candidates.add(join(dirs.java(), dir, 'bin', exe));
    }
  } catch {
  }

  for (const c of candidates) {
    const rt = await probe(c);
    if (rt) found.push(c.includes(dirs.java()) ? { ...rt, source: 'managed' } : rt);
  }
  return found;
}

export function requiredJavaMajor(mcVersion: string, fromJson?: number): number {
  if (fromJson) return fromJson;
  const minor = Number(mcVersion.split('.')[1] ?? 0);
  if (minor >= 21) return 21;
  if (minor >= 17) return 17;
  return 8;
}

export async function ensureJava(major: number): Promise<JavaRuntime> {
  const existing = (await listJava()).find((j) => j.major === major);
  if (existing) return existing;

  const os = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux';
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x64';
  const ext = os === 'windows' ? 'zip' : 'tar.gz';
  const url = `https://api.adoptium.net/v3/binary/latest/${major}/ga/${os}/${arch}/jre/hotspot/normal/eclipse`;

  await mkdir(dirs.java(), { recursive: true });
  const archive = join(dirs.java(), `temurin-${major}.${ext}`);

  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`temurin download failed: http ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(archive));

  const targetDir = join(dirs.java(), `temurin-${major}`);
  await mkdir(targetDir, { recursive: true });
  if (ext === 'zip') {
    await execFileAsync('powershell', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -Force -Path "${archive}" -DestinationPath "${targetDir}"`
    ]);
  } else {
    await execFileAsync('tar', ['-xzf', archive, '-C', targetDir, '--strip-components=1']);
  }

  const exe = process.platform === 'win32' ? 'java.exe' : 'java';
  let binPath = join(targetDir, 'bin', exe);
  try {
    const entries = await readdir(targetDir);
    const nested = entries.find((e) => e.startsWith('jdk') || e.startsWith('jre'));
    if (nested) binPath = join(targetDir, nested, 'bin', exe);
  } catch {
  }
  if (process.platform !== 'win32') await chmod(binPath, 0o755).catch(() => undefined);

  const rt = await probe(binPath);
  if (!rt) throw new Error('temurin: java -version failed after install');
  return { ...rt, source: 'managed' };
}
