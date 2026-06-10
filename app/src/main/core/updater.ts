import { z } from 'zod';
import { USER_AGENT } from './download';
import type { UpdateInfo } from '@shared/types';

export const APP_VERSION = '1.0.0-beta';
export const GITHUB_REPO = 'AkyRayy/akylauncher';

const ReleaseSchema = z.object({
  tag_name: z.string(),
  html_url: z.string().url(),
  prerelease: z.boolean().optional(),
  draft: z.boolean().optional()
});

export function parseSemver(tag: string): [number, number, number] {
  const m = tag.replace(/^v/i, '').match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return [0, 0, 0];
  return [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
}

export function isNewer(latest: string, current: string): boolean {
  const a = parseSemver(latest);
  const b = parseSemver(current);
  for (let i = 0; i < 3; i++) {
    if (a[i]! > b[i]!) return true;
    if (a[i]! < b[i]!) return false;
  }
  return false;
}

export async function checkUpdate(): Promise<UpdateInfo> {
  const none: UpdateInfo = { available: false, current: APP_VERSION, latest: null, url: null };
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/vnd.github+json' }
    });
    if (!res.ok) return none;
    const release = ReleaseSchema.parse(await res.json());
    if (release.draft) return none;
    const latest = release.tag_name;
    return {
      available: isNewer(latest, APP_VERSION),
      current: APP_VERSION,
      latest,
      url: release.html_url
    };
  } catch {
    return none;
  }
}
