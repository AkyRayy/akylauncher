import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { dirs } from './paths';
import { loadJson, saveJson, InstancesFileSchema } from './store';
import type { InstanceConfig, LoaderKind } from '@shared/types';

const FILE = 'instances.json';

export async function listInstances(): Promise<InstanceConfig[]> {
  return loadJson(FILE, InstancesFileSchema, []);
}

export async function createInstance(
  name: string,
  mcVersion: string,
  loader: LoaderKind,
  defaults: { ramMb: number; windowWidth: number; windowHeight: number }
): Promise<InstanceConfig> {
  const all = await listInstances();
  const inst: InstanceConfig = {
    id: randomUUID(),
    name: name.trim() || `${loader} ${mcVersion}`,
    mcVersion,
    loader,
    loaderVersion: null,
    createdAt: new Date().toISOString(),
    lastPlayedAt: null,
    ramMb: defaults.ramMb,
    javaPath: null,
    jvmArgs: [],
    windowWidth: defaults.windowWidth,
    windowHeight: defaults.windowHeight,
    modsCount: 0
  };
  await mkdir(dirs.instanceDir(inst.id), { recursive: true });
  await saveJson(FILE, [...all, inst]);
  return inst;
}

export async function updateInstance(id: string, patch: Partial<InstanceConfig>): Promise<InstanceConfig> {
  const all = await listInstances();
  const idx = all.findIndex((i) => i.id === id);
  if (idx === -1) throw new Error(`instance not found: ${id}`);
  const updated = { ...all[idx]!, ...patch, id };
  all[idx] = updated;
  await saveJson(FILE, all);
  return updated;
}

export async function deleteInstance(id: string): Promise<void> {
  const all = await listInstances();
  await saveJson(FILE, all.filter((i) => i.id !== id));
  await rm(dirs.instanceDir(id), { recursive: true, force: true }).catch(() => undefined);
}
