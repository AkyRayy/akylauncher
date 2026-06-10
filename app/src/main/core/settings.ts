import { totalmem } from 'node:os';
import { loadJson, saveJson, SettingsSchema } from './store';
import { dirs } from './paths';
import type { AppSettings } from '@shared/types';

const FILE = 'settings.json';

export function defaultSettings(): AppSettings {
  const totalMb = Math.floor(totalmem() / 1024 / 1024);
  return {
    gameDir: dirs.root(),
    defaultRamMb: Math.min(4096, Math.floor(totalMb / 2)),
    maxRamMb: totalMb,
    jvmArgs: [],
    windowWidth: 1280,
    windowHeight: 720,
    keepLauncherOpen: true,
    groqApiKey: '',
    skinsInGame: true
  };
}

export async function getSettings(): Promise<AppSettings> {
  return loadJson(FILE, SettingsSchema, defaultSettings());
}

export async function setSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const next = { ...(await getSettings()), ...patch };
  await saveJson(FILE, next);
  return next;
}
