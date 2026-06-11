import { BrowserWindow, ipcMain } from 'electron';
import type { AkyApi, AkyEventChannel, AkyEvents } from '@shared/ipc-contract';
import { listVersions, installVersion } from '../core/versions';
import { createInstance, deleteInstance, listInstances, updateInstance } from '../core/instances';
import { createOfflineProfile, deleteProfile, listProfiles, setActiveProfile, activeProfile } from '../core/profiles';
import { ensureJava, listJava } from '../core/java';
import { gameState, killGame } from '../core/launch';
import { getSettings, setSettings } from '../core/settings';
import { searchMods, installMod, listModFiles, deleteModFile } from '../core/modrinth';
import { offlineSession } from '../core/auth';
import { dirs } from '../core/paths';
import { pickAndSetSkin, getSkinDataUrl, clearSkin } from '../core/skins';
import { checkUpdate } from '../core/updater';
import { zipDirectory } from '../core/zip';
import { updatePresence, TELEGRAM_URL, rpcStatus, onRpcStatus } from '../core/discord';
import { shell, dialog } from 'electron';
import { bootstrapAndLaunch } from '../core/bootstrap';
import { analyzeLog } from '../core/ai';

export function registerIpc(win: BrowserWindow): void {
  const emit = <E extends AkyEventChannel>(channel: E, payload: AkyEvents[E]) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  };

  const handle = <C extends keyof AkyApi>(channel: C, fn: AkyApi[C]) => {
    ipcMain.handle(channel, (_evt, ...args) => (fn as (...a: unknown[]) => unknown)(...args));
  };

  handle('versions:list', ({ force } = {}) => listVersions(force));
  handle('versions:install', async ({ versionId }) => {
    const taskId = `install-${versionId}`;
    void installVersion(versionId, (p) => emit('evt:download-progress', p)).catch(() => undefined);
    return { taskId };
  });

  handle('instances:list', () => listInstances());
  handle('instances:create', async ({ name, mcVersion, loader }) => {
    const s = await getSettings();
    return createInstance(name, mcVersion, loader, {
      ramMb: s.defaultRamMb,
      windowWidth: s.windowWidth,
      windowHeight: s.windowHeight
    });
  });
  handle('instances:update', ({ id, patch }) => updateInstance(id, patch));
  handle('instances:delete', ({ id }) => deleteInstance(id));
  handle('instances:export', async ({ id }) => {
    const inst = (await listInstances()).find((i) => i.id === id);
    if (!inst) throw new Error('профиль не найден');
    const safe = inst.name.replace(/[^\w\d-]+/g, '_').toLowerCase() || 'profile';
    const result = await dialog.showSaveDialog({
      title: 'Экспорт профиля',
      defaultPath: `${safe}-${inst.mcVersion}.zip`,
      filters: [{ name: 'Zip archive', extensions: ['zip'] }]
    });
    if (result.canceled || !result.filePath) return { ok: false, path: null, files: 0 };
    const manifest = Buffer.from(
      JSON.stringify(
        {
          format: 'akylauncher/profile@1',
          name: inst.name,
          mcVersion: inst.mcVersion,
          loader: inst.loader,
          loaderVersion: inst.loaderVersion,
          ramMb: inst.ramMb,
          jvmArgs: inst.jvmArgs,
          windowWidth: inst.windowWidth,
          windowHeight: inst.windowHeight,
          exportedAt: new Date().toISOString()
        },
        null,
        2
      )
    );
    const files = await zipDirectory(dirs.instanceDir(id), result.filePath, [
      { name: 'akyprofile.json', data: manifest }
    ]);
    return { ok: true, path: result.filePath, files };
  });

  handle('profiles:list', () => listProfiles());
  handle('profiles:createOffline', ({ nickname }) => createOfflineProfile(nickname));
  handle('profiles:setActive', ({ id }) => setActiveProfile(id));
  handle('profiles:delete', ({ id }) => deleteProfile(id));
  handle('profiles:setSkin', async ({ id }) => ({ ok: await pickAndSetSkin(id) }));
  handle('profiles:getSkin', async ({ id }) => ({ dataUrl: await getSkinDataUrl(id) }));
  handle('profiles:clearSkin', ({ id }) => clearSkin(id));

  handle('java:list', () => listJava());
  handle('java:ensure', async ({ major }) => {
    emit('evt:download-progress', {
      taskId: `java-${major}`, label: `temurin ${major}`, ratio: 0.5, done: 0, total: 1,
      speedBps: 0, phase: 'java', message: `java ${major} · загрузка`
    });
    const rt = await ensureJava(major);
    emit('evt:download-progress', {
      taskId: `java-${major}`, label: `temurin ${major}`, ratio: 1, done: 1, total: 1,
      speedBps: 0, phase: 'done', message: `java ${major} · установлена`
    });
    return rt;
  });

  handle('game:launch', async ({ instanceId }) => {
    const inst = (await listInstances()).find((i) => i.id === instanceId);
    if (!inst) throw new Error('профиль не найден');
    const profile = await activeProfile();
    if (!profile) throw new Error('нет активного профиля · добавь ник');

    try {
      const pid = await bootstrapAndLaunch(inst, offlineSession(profile.nickname), {
        onProgress: (p) => emit('evt:download-progress', p),
        onLog: (l) => emit('evt:game-log', l),
        onState: (s) => emit('evt:game-state', s)
      });
      return { pid };
    } catch (err) {
      const msg = (err as Error).message;
      emit('evt:game-log', { ts: Date.now(), level: 'ERROR', text: `launch failed · ${msg}` });
      emit('evt:download-progress', {
        taskId: `launch-${instanceId}`, label: inst.name, ratio: 0, done: 0, total: 0,
        speedBps: 0, phase: 'error', message: `запуск прерван · ${msg}`
      });
      throw err;
    }
  });
  handle('game:kill', async () => killGame());
  handle('game:state', async () => gameState());

  handle('settings:get', () => getSettings());
  handle('settings:set', ({ patch }) => setSettings(patch));

  handle('modrinth:search', ({ query, mcVersion, loader, offset, sort }) =>
    searchMods(query, mcVersion, loader, offset, sort)
  );
  handle('modrinth:install', ({ projectId, instanceId }) => installMod(projectId, instanceId));

  handle('mods:listFiles', ({ instanceId }) => listModFiles(instanceId));
  handle('mods:deleteFile', ({ instanceId, filename }) => deleteModFile(instanceId, filename));

  handle('ai:analyze', async ({ lines, context }) => ({ text: await analyzeLog(lines, context) }));

  handle('app:openDir', async ({ instanceId } = {}) => {
    await shell.openPath(instanceId ? dirs.instanceDir(instanceId) : dirs.root());
  });
  handle('app:checkUpdate', () => checkUpdate());
  handle('app:openTelegram', async () => {
    await shell.openExternal(TELEGRAM_URL);
  });
  handle('app:presenceSelect', async ({ instanceId }) => {
    const inst = instanceId ? (await listInstances()).find((i) => i.id === instanceId) ?? null : null;
    const profile = await activeProfile();
    updatePresence({ instance: inst, nickname: profile?.nickname ?? null });
  });
  handle('app:rpcStatus', async () => rpcStatus());

  onRpcStatus((s: 'connecting' | 'connected' | 'unavailable', err: string | null) => {
    emit('evt:game-log', {
      ts: Date.now(),
      level: s === 'connected' ? 'INFO' : s === 'unavailable' ? 'WARN' : 'DEBUG',
      text:
        s === 'connected'
          ? 'discord rpc · подключён'
          : s === 'unavailable'
            ? `discord rpc · недоступен · ${err ?? 'нет ответа'} · повтор через 15с`
            : 'discord rpc · подключаюсь'
    });
  });

  handle('win:minimize', async () => win.minimize());
  handle('win:maximize', async () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
  handle('win:close', async () => win.close());
}
