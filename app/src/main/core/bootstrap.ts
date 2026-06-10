import type { DownloadProgress, GameLogLine, GameState, InstanceConfig } from '@shared/types';
import { installVersion, isVersionInstalled, resolveVersionJson } from './versions';
import { installFabricLike } from './loaders';
import { installForgeLike } from './forge';
import { ensureJava, requiredJavaMajor } from './java';
import { spawnGame } from './launch';
import { updateInstance } from './instances';
import { getSettings } from './settings';
import { ensureAuthlibInjector, elyJvmArgs } from './authlib';
import type { Session } from './auth';

export interface BootstrapIo {
  onProgress: (p: DownloadProgress) => void;
  onLog: (l: GameLogLine) => void;
  onState: (s: GameState) => void;
}

const log = (io: BootstrapIo, level: GameLogLine['level'], text: string) =>
  io.onLog({ ts: Date.now(), level, text });

export async function bootstrapAndLaunch(
  inst: InstanceConfig,
  session: Session,
  io: BootstrapIo
): Promise<number> {
  log(io, 'INFO', `launch · ${inst.name} · ${inst.mcVersion} · ${inst.loader}`);

  if (!(await isVersionInstalled(inst.mcVersion))) {
    log(io, 'INFO', `версия ${inst.mcVersion} не установлена · скачиваю`);
    await installVersion(inst.mcVersion, io.onProgress);
    log(io, 'INFO', `версия ${inst.mcVersion} · готова`);
  }

  const baseJson = await resolveVersionJson(inst.mcVersion);
  const major = requiredJavaMajor(inst.mcVersion, baseJson.javaVersion?.majorVersion);
  log(io, 'INFO', `java ${major} · проверяю`);
  io.onProgress({
    taskId: `java-${major}`, label: `java ${major}`, ratio: 0.3, done: 0, total: 1,
    speedBps: 0, phase: 'java', message: `java ${major} · поиск или загрузка`
  });
  const java = inst.javaPath
    ? { path: inst.javaPath, version: 'custom', major, source: 'system' as const }
    : await ensureJava(major);
  io.onProgress({
    taskId: `java-${major}`, label: `java ${major}`, ratio: 1, done: 1, total: 1,
    speedBps: 0, phase: 'done', message: `java ${major} · установлена`
  });
  log(io, 'INFO', `java ${java.version} · ${java.path}`);

  let launchId = inst.loaderVersion ?? inst.mcVersion;
  const needLoader =
    inst.loader !== 'vanilla' &&
    !(inst.loaderVersion && (await isVersionInstalled(inst.loaderVersion, false)));

  if (needLoader) {
    log(io, 'INFO', `${inst.loader} · устанавливаю`);
    io.onProgress({
      taskId: `loader-${inst.id}`, label: inst.loader, ratio: 0.5, done: 0, total: 1,
      speedBps: 0, phase: 'loader', message: `${inst.loader} · установка`
    });
    if (inst.loader === 'fabric' || inst.loader === 'quilt') {
      launchId = await installFabricLike(inst.loader, inst.mcVersion);
    } else if (inst.loader === 'forge' || inst.loader === 'neoforge') {
      launchId = await installForgeLike(inst.loader, inst.mcVersion, java.path, (t) =>
        log(io, 'INFO', t)
      );
    }
    await updateInstance(inst.id, { loaderVersion: launchId });
    inst = { ...inst, loaderVersion: launchId };
    io.onProgress({
      taskId: `loader-${inst.id}`, label: inst.loader, ratio: 1, done: 1, total: 1,
      speedBps: 0, phase: 'done', message: `${inst.loader} · готов`
    });
    log(io, 'INFO', `${inst.loader} · профиль ${launchId}`);
  }

  const vjson = await resolveVersionJson(launchId);

  const extraJvmArgs: string[] = [];
  const settings = await getSettings();
  if (settings.skinsInGame) {
    try {
      log(io, 'INFO', 'скины в игре · подключаю authlib-injector (ely.by)');
      const jar = await ensureAuthlibInjector();
      extraJvmArgs.push(...elyJvmArgs(jar));
      log(io, 'INFO', 'authlib-injector · готов · скин подтянется с ely.by по нику');
    } catch (err) {
      log(io, 'WARN', `authlib-injector недоступен · ${(err as Error).message} · запускаю без скинов`);
    }
  }

  log(io, 'INFO', 'собираю аргументы и запускаю jvm');
  const pid = await spawnGame(inst, vjson, launchId, session, java.path, io.onLog, io.onState, extraJvmArgs);
  log(io, 'INFO', `process started · pid ${pid}`);
  await updateInstance(inst.id, { lastPlayedAt: new Date().toISOString() });
  return pid;
}
