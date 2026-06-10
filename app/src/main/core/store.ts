import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { dirs } from './paths';

export async function loadJson<T>(
  name: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  fallback: T
): Promise<T> {
  try {
    const raw = JSON.parse(await readFile(join(dirs.config(), name), 'utf8'));
    return schema.parse(raw);
  } catch {
    return fallback;
  }
}

export async function saveJson(name: string, data: unknown): Promise<void> {
  await mkdir(dirs.config(), { recursive: true });
  await writeFile(join(dirs.config(), name), JSON.stringify(data, null, 2));
}

export const InstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  mcVersion: z.string(),
  loader: z.enum(['vanilla', 'fabric', 'quilt', 'forge', 'neoforge']),
  loaderVersion: z.string().nullable(),
  createdAt: z.string(),
  lastPlayedAt: z.string().nullable(),
  ramMb: z.number().int().min(512),
  javaPath: z.string().nullable(),
  jvmArgs: z.array(z.string()),
  windowWidth: z.number().int(),
  windowHeight: z.number().int(),
  modsCount: z.number().int()
});

export const ProfileSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  uuid: z.string(),
  kind: z.enum(['offline', 'elyby']),
  active: z.boolean(),
  skinPath: z.string().nullable().default(null)
});

export const SettingsSchema = z.object({
  gameDir: z.string(),
  defaultRamMb: z.number().int(),
  maxRamMb: z.number().int(),
  jvmArgs: z.array(z.string()),
  windowWidth: z.number().int(),
  windowHeight: z.number().int(),
  keepLauncherOpen: z.boolean(),
  groqApiKey: z.string().default(''),
  skinsInGame: z.boolean().default(true)
});

export const InstancesFileSchema = z.array(InstanceSchema);
export const ProfilesFileSchema = z.array(ProfileSchema);
