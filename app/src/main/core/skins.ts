import { dialog } from 'electron';
import { copyFile, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { dirs } from './paths';
import { listProfiles, updateProfile } from './profiles';

const MAX_SKIN_BYTES = 256 * 1024;

function skinsDir(): string {
  return join(dirs.root(), 'skins');
}

export function skinFilePath(profileId: string): string {
  return join(skinsDir(), `${profileId}.png`);
}

export async function pickAndSetSkin(profileId: string): Promise<boolean> {
  const profile = (await listProfiles()).find((p) => p.id === profileId);
  if (!profile) throw new Error('профиль не найден');

  const result = await dialog.showOpenDialog({
    title: 'Выбери скин · PNG 64×64',
    filters: [{ name: 'Minecraft skin', extensions: ['png'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return false;

  const src = result.filePaths[0];
  const info = await stat(src);
  if (info.size > MAX_SKIN_BYTES) throw new Error('файл больше 256KB · это не скин');

  const buf = await readFile(src);
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error('файл не png');
  }

  await mkdir(skinsDir(), { recursive: true });
  const dest = skinFilePath(profileId);
  await copyFile(src, dest);
  await updateProfile(profileId, { skinPath: dest });
  return true;
}

export async function getSkinDataUrl(profileId: string): Promise<string | null> {
  const profile = (await listProfiles()).find((p) => p.id === profileId);
  if (!profile?.skinPath) return null;
  try {
    const buf = await readFile(profile.skinPath);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function clearSkin(profileId: string): Promise<void> {
  await rm(skinFilePath(profileId), { force: true });
  await updateProfile(profileId, { skinPath: null });
}
