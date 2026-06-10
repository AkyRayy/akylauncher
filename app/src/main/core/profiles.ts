import { randomUUID } from 'node:crypto';
import { loadJson, saveJson, ProfilesFileSchema } from './store';
import { offlineUuid, validNickname } from './auth';
import type { ProfileConfig } from '@shared/types';

const FILE = 'profiles.json';

export async function listProfiles(): Promise<ProfileConfig[]> {
  return loadJson(FILE, ProfilesFileSchema, []);
}

export async function createOfflineProfile(nickname: string): Promise<ProfileConfig> {
  if (!validNickname(nickname)) throw new Error('ник: 3–16 символов, A-Z a-z 0-9 _');
  const all = await listProfiles();
  if (all.some((p) => p.nickname.toLowerCase() === nickname.toLowerCase())) {
    throw new Error('такой ник уже добавлен');
  }
  const profile: ProfileConfig = {
    id: randomUUID(),
    nickname,
    uuid: offlineUuid(nickname),
    kind: 'offline',
    active: all.length === 0,
    skinPath: null
  };
  await saveJson(FILE, [...all, profile]);
  return profile;
}

export async function updateProfile(id: string, patch: Partial<ProfileConfig>): Promise<ProfileConfig> {
  const all = await listProfiles();
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error(`профиль не найден: ${id}`);
  const updated = { ...all[idx]!, ...patch, id };
  all[idx] = updated;
  await saveJson(FILE, all);
  return updated;
}

export async function setActiveProfile(id: string): Promise<void> {
  const all = await listProfiles();
  await saveJson(FILE, all.map((p) => ({ ...p, active: p.id === id })));
}

export async function deleteProfile(id: string): Promise<void> {
  const all = await listProfiles();
  const rest = all.filter((p) => p.id !== id);
  if (rest.length > 0 && !rest.some((p) => p.active)) rest[0]!.active = true;
  await saveJson(FILE, rest);
}

export async function activeProfile(): Promise<ProfileConfig | null> {
  return (await listProfiles()).find((p) => p.active) ?? null;
}
