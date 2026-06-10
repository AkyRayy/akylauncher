import { join } from 'node:path';
import { mkdir, access } from 'node:fs/promises';
import { z } from 'zod';
import { dirs } from './paths';
import { downloadAll, fetchJson } from './download';

const LatestSchema = z.object({
  version: z.string(),
  download_url: z.string().url()
});

export async function ensureAuthlibInjector(): Promise<string> {
  const dir = join(dirs.root(), 'authlib');
  const jar = join(dir, 'authlib-injector.jar');
  try {
    await access(jar);
    return jar;
  } catch {
    const latest = LatestSchema.parse(
      await fetchJson('https://authlib-injector.yushi.moe/artifact/latest.json')
    );
    await mkdir(dir, { recursive: true });
    await downloadAll([{ url: latest.download_url, dest: jar }]);
    return jar;
  }
}

export function elyJvmArgs(jarPath: string): string[] {
  return [`-javaagent:${jarPath}=ely.by`, '-Dauthlibinjector.side=client'];
}
