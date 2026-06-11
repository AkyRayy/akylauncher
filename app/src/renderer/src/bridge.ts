import type { AkyBridge, AkyEventChannel, AkyEvents } from '@shared/ipc-contract';
import type {
  AppSettings,
  GameLogLine,
  GameState,
  InstanceConfig,
  ProfileConfig,
  VersionSummary
} from '@shared/types';

declare global {
  interface Window {
    aky?: AkyBridge;
  }
}

type Listener = (payload: never) => void;
const listeners = new Map<AkyEventChannel, Set<Listener>>();

function mockEmit<E extends AkyEventChannel>(channel: E, payload: AkyEvents[E]): void {
  listeners.get(channel)?.forEach((fn) => (fn as (p: AkyEvents[E]) => void)(payload));
}

const mockVersions: VersionSummary[] = [
  { id: '1.21.4', kind: 'release', url: '', releaseTime: '2024-12-03T10:12:57+00:00', installed: true },
  { id: '1.21.3', kind: 'release', url: '', releaseTime: '2024-10-23T12:28:15+00:00', installed: false },
  { id: '25w20a', kind: 'snapshot', url: '', releaseTime: '2025-05-13T11:02:00+00:00', installed: false },
  { id: '1.20.6', kind: 'release', url: '', releaseTime: '2024-04-29T12:00:00+00:00', installed: true },
  { id: '1.20.1', kind: 'release', url: '', releaseTime: '2023-06-12T13:25:51+00:00', installed: true },
  { id: '1.19.2', kind: 'release', url: '', releaseTime: '2022-08-05T11:57:05+00:00', installed: false },
  { id: '1.18.2', kind: 'release', url: '', releaseTime: '2022-02-28T10:42:45+00:00', installed: false },
  { id: '1.16.5', kind: 'release', url: '', releaseTime: '2021-01-14T16:05:32+00:00', installed: false },
  { id: '1.12.2', kind: 'release', url: '', releaseTime: '2017-09-18T08:39:46+00:00', installed: false },
  { id: '1.8.9', kind: 'release', url: '', releaseTime: '2015-12-03T09:24:39+00:00', installed: false },
  { id: 'b1.7.3', kind: 'old_beta', url: '', releaseTime: '2011-07-08T22:00:00+00:00', installed: false }
];

let mockInstances: InstanceConfig[] = [
  {
    id: 'inst-1', name: 'SURVIVAL MAIN', mcVersion: '1.21.4', loader: 'fabric',
    loaderVersion: 'fabric-loader-0.16.10-1.21.4', createdAt: '2025-03-01T10:00:00Z',
    lastPlayedAt: '2025-06-09T21:14:00Z', ramMb: 6144, javaPath: null, jvmArgs: [],
    windowWidth: 1920, windowHeight: 1080, modsCount: 14
  },
  {
    id: 'inst-2', name: 'RLCRAFT', mcVersion: '1.12.2', loader: 'forge',
    loaderVersion: null, createdAt: '2025-04-11T10:00:00Z',
    lastPlayedAt: '2025-05-28T18:40:00Z', ramMb: 8192, javaPath: null, jvmArgs: [],
    windowWidth: 1280, windowHeight: 720, modsCount: 169
  },
  {
    id: 'inst-3', name: 'VANILLA PURE', mcVersion: '1.20.6', loader: 'vanilla',
    loaderVersion: null, createdAt: '2025-05-02T10:00:00Z',
    lastPlayedAt: null, ramMb: 4096, javaPath: null, jvmArgs: [],
    windowWidth: 1280, windowHeight: 720, modsCount: 0
  }
];

let mockProfiles: ProfileConfig[] = [
  { id: 'p-1', nickname: 'AkyPlayer', uuid: 'c06f8906-4c8a-3b91-9c10-aa2b784a9c21', kind: 'offline', active: true, skinPath: null },
  { id: 'p-2', nickname: 'TestDummy', uuid: '7a3c1f44-9b2e-3d18-8f4e-bb1c22d93e07', kind: 'offline', active: false, skinPath: null }
];

const mockSkins = new Map<string, string>();

let mockSettings: AppSettings = {
  gameDir: 'C:\\Users\\aky\\AppData\\Roaming\\akylauncher\\game',
  defaultRamMb: 4096, maxRamMb: 16384, jvmArgs: [],
  windowWidth: 1280, windowHeight: 720, keepLauncherOpen: true,
  groqApiKey: '', skinsInGame: true
};

let mockGame: GameState = { running: false, pid: null, instanceId: null, startedAt: null };

const mockModFiles = new Map<string, string[]>([
  ['inst-1', ['sodium-0.6.5+mc1.21.4.jar', 'fabric-api-0.115.0+1.21.4.jar', 'lithium-0.14.3+mc1.21.4.jar']]
]);

function fakeUuid(nick: string): string {
  let h = 0;
  for (const c of nick) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hex = (h.toString(16) + '0'.repeat(32)).slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-3${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function simulateInstall(versionId: string): void {
  const total = 2810;
  let done = 0;
  const tick = () => {
    done = Math.min(done + Math.floor(120 + Math.random() * 240), total);
    mockEmit('evt:download-progress', {
      taskId: `install-${versionId}`, label: versionId,
      ratio: done / total, done, total,
      speedBps: 6_400_000 + Math.random() * 4_000_000,
      phase: done < 200 ? 'client' : done < 900 ? 'libraries' : done < total ? 'assets' : 'done',
      message:
        done < 200 ? 'downloading client.jar'
        : done < 900 ? `libraries ${done}/900`
        : done < total ? `fetching assets ${done}/${total}`
        : 'версия готова'
    });
    if (done < total) setTimeout(tick, 180);
    else {
      const v = mockVersions.find((x) => x.id === versionId);
      if (v) v.installed = true;
    }
  };
  setTimeout(tick, 250);
}

const MOCK_LOG_LINES: Array<[GameLogLine['level'], string]> = [
  ['INFO', 'Loading Minecraft 1.21.4 with Fabric Loader 0.16.10'],
  ['INFO', 'Loaded configuration file for Sodium: 42 options available'],
  ['INFO', 'Initializing LWJGL 3.3.3'],
  ['INFO', 'OpenAL initialized on device OpenAL Soft'],
  ['INFO', 'Created: 1024x1024x4 minecraft:textures/atlas/blocks.png-atlas'],
  ['WARN', 'Missing sound for event: minecraft:item.goat_horn.play'],
  ['INFO', 'Sound engine started'],
  ['INFO', 'Setting user: AkyPlayer'],
  ['INFO', 'Backend library: LWJGL version 3.3.3'],
  ['WARN', 'Shader rendertype_entity_translucent_emissive could not find sampler named Sampler2'],
  ['INFO', 'Preparing spawn area: 0%'],
  ['INFO', 'Preparing spawn area: 47%'],
  ['INFO', 'Time elapsed: 4213 ms'],
  ['INFO', 'Loaded 1290 advancements'],
  ['ERROR', 'Failed to fetch player skin: connect timed out (offline mode)'],
  ['INFO', 'Chunk render dispatcher: 8 threads']
];

function simulateGame(instanceId: string): void {
  const inst = mockInstances.find((i) => i.id === instanceId);
  const log = (level: GameLogLine['level'], text: string) =>
    mockEmit('evt:game-log', { ts: Date.now(), level, text });

  log('INFO', `launch · ${inst?.name ?? '?'} · ${inst?.mcVersion ?? '?'} · ${inst?.loader ?? '?'}`);
  const installed = mockVersions.find((v) => v.id === inst?.mcVersion)?.installed ?? true;
  let delay = 400;
  if (!installed && inst) {
    log('INFO', `версия ${inst.mcVersion} не установлена · скачиваю`);
    simulateInstall(inst.mcVersion);
    delay = 5200;
    setTimeout(() => log('INFO', `версия ${inst.mcVersion} · готова`), delay - 600);
  }
  setTimeout(() => {
    log('INFO', 'java 21 · проверяю');
    log('INFO', 'java 21.0.3 · C:\\…\\temurin-21\\bin\\java.exe');
    log('INFO', 'собираю аргументы и запускаю jvm');
    mockGame = { running: true, pid: 24816, instanceId, startedAt: Date.now() };
    mockEmit('evt:game-state', mockGame);
    log('INFO', 'process started · pid 24816');
    let i = 0;
    const tick = () => {
      if (!mockGame.running) return;
      const entry = MOCK_LOG_LINES[i % MOCK_LOG_LINES.length]!;
      mockEmit('evt:game-log', { ts: Date.now(), level: entry[0], text: entry[1] });
      i++;
      if (i < 60) setTimeout(tick, 350 + Math.random() * 500);
    };
    setTimeout(tick, 300);
  }, delay);
}

const mockBridge: AkyBridge = {
  invoke: ((channel: string, args?: any): Promise<unknown> => {
    switch (channel) {
      case 'versions:list':
        return Promise.resolve(mockVersions);
      case 'versions:install':
        simulateInstall(args.versionId);
        return Promise.resolve({ taskId: `install-${args.versionId}` });
      case 'instances:list':
        return Promise.resolve(mockInstances);
      case 'instances:create': {
        const inst: InstanceConfig = {
          id: `inst-${Date.now()}`, name: args.name || `${args.loader} ${args.mcVersion}`.toUpperCase(),
          mcVersion: args.mcVersion, loader: args.loader, loaderVersion: null,
          createdAt: new Date().toISOString(), lastPlayedAt: null,
          ramMb: mockSettings.defaultRamMb, javaPath: null, jvmArgs: [],
          windowWidth: mockSettings.windowWidth, windowHeight: mockSettings.windowHeight, modsCount: 0
        };
        mockInstances = [...mockInstances, inst];
        return Promise.resolve(inst);
      }
      case 'instances:update': {
        mockInstances = mockInstances.map((i) => (i.id === args.id ? { ...i, ...args.patch } : i));
        return Promise.resolve(mockInstances.find((i) => i.id === args.id));
      }
      case 'instances:delete':
        mockInstances = mockInstances.filter((i) => i.id !== args.id);
        return Promise.resolve(undefined);
      case 'instances:export': {
        const inst = mockInstances.find((i) => i.id === args.id);
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                path: `C:\\Users\\aky\\Desktop\\${(inst?.name ?? 'profile').toLowerCase().replace(/\s+/g, '_')}-${inst?.mcVersion ?? ''}.zip`,
                files: 18
              }),
            900
          )
        );
      }
      case 'profiles:list':
        return Promise.resolve(mockProfiles);
      case 'profiles:createOffline': {
        if (!/^[A-Za-z0-9_]{3,16}$/.test(args.nickname)) {
          return Promise.reject(new Error('ник: 3–16 символов, A-Z a-z 0-9 _'));
        }
        const p: ProfileConfig = {
          id: `p-${Date.now()}`, nickname: args.nickname, uuid: fakeUuid(args.nickname),
          kind: 'offline', active: mockProfiles.length === 0, skinPath: null
        };
        mockProfiles = [...mockProfiles, p];
        return Promise.resolve(p);
      }
      case 'profiles:setActive':
        mockProfiles = mockProfiles.map((p) => ({ ...p, active: p.id === args.id }));
        return Promise.resolve(undefined);
      case 'profiles:delete':
        mockProfiles = mockProfiles.filter((p) => p.id !== args.id);
        if (mockProfiles.length && !mockProfiles.some((p) => p.active)) mockProfiles[0]!.active = true;
        return Promise.resolve(undefined);
      case 'profiles:setSkin': {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#7a5c3c'; ctx.fillRect(8, 8, 8, 8);
        ctx.fillStyle = '#3a2f23'; ctx.fillRect(8, 8, 8, 3);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(9, 12, 2, 1); ctx.fillRect(13, 12, 2, 1);
        ctx.fillStyle = '#1b2a16'; ctx.fillRect(10, 12, 1, 1); ctx.fillRect(14, 12, 1, 1);
        mockSkins.set(args.id as string, canvas.toDataURL('image/png'));
        mockProfiles = mockProfiles.map((p) => (p.id === args.id ? { ...p, skinPath: 'mock.png' } : p));
        return Promise.resolve({ ok: true });
      }
      case 'profiles:getSkin':
        return Promise.resolve({ dataUrl: mockSkins.get(args.id as string) ?? null });
      case 'profiles:clearSkin':
        mockSkins.delete(args.id as string);
        mockProfiles = mockProfiles.map((p) => (p.id === args.id ? { ...p, skinPath: null } : p));
        return Promise.resolve(undefined);
      case 'app:checkUpdate':
        return Promise.resolve({ available: true, current: '1.0.0-beta', latest: 'v1.1.0', url: 'https://github.com/AkyRayy/akylauncher/releases/latest' });
      case 'app:openTelegram':
        window.open('https://t.me/AkyLauncher', '_blank');
        return Promise.resolve(undefined);
      case 'app:presenceSelect':
        return Promise.resolve(undefined);
      case 'app:rpcStatus':
        return Promise.resolve({ status: 'connected', error: null });
      case 'java:list':
        return Promise.resolve([
          { path: 'C:\\Program Files\\Java\\jdk-21\\bin\\java.exe', version: '21.0.3', major: 21, source: 'system' },
          { path: '…\\akylauncher\\game\\java\\temurin-17\\bin\\java.exe', version: '17.0.11', major: 17, source: 'managed' }
        ]);
      case 'java:ensure':
        return Promise.resolve({ path: 'java', version: '21.0.3', major: 21, source: 'managed' });
      case 'game:launch':
        simulateGame(args.instanceId);
        return Promise.resolve({ pid: 24816 });
      case 'game:kill':
        mockGame = { running: false, pid: null, instanceId: null, startedAt: null };
        mockEmit('evt:game-state', mockGame);
        mockEmit('evt:game-log', { ts: Date.now(), level: 'WARN', text: 'process killed · code 137' });
        return Promise.resolve(undefined);
      case 'game:state':
        return Promise.resolve(mockGame);
      case 'settings:get':
        return Promise.resolve(mockSettings);
      case 'settings:set':
        mockSettings = { ...mockSettings, ...args.patch };
        return Promise.resolve(mockSettings);
      case 'modrinth:search': {
        const all = [
          { projectId: 'AANobbMI', slug: 'sodium', title: 'Sodium', description: 'Современный движок рендера: радикально выше FPS без изменения картинки.', downloads: 38_412_900, follows: 41_200, categories: ['optimization'], iconUrl: null, updatedAt: 9, createdAt: 3 },
          { projectId: 'P7dR8mSH', slug: 'fabric-api', title: 'Fabric API', description: 'Базовая библиотека хуков и интерфейсов для модов на Fabric.', downloads: 61_034_220, follows: 28_400, categories: ['library'], iconUrl: null, updatedAt: 10, createdAt: 1 },
          { projectId: 'gvQqBUqZ', slug: 'lithium', title: 'Lithium', description: 'Оптимизация логики сервера и физики без изменения геймплея.', downloads: 19_882_140, follows: 17_300, categories: ['optimization'], iconUrl: null, updatedAt: 7, createdAt: 4 },
          { projectId: 'YL57xq9U', slug: 'iris', title: 'Iris Shaders', description: 'Шейдеры, совместимые с OptiFine-паками, поверх Sodium.', downloads: 22_410_080, follows: 25_100, categories: ['rendering'], iconUrl: null, updatedAt: 8, createdAt: 5 },
          { projectId: '1IjD5062', slug: 'continuity', title: 'Continuity', description: 'Соединённые текстуры в ванильном стиле для Fabric.', downloads: 6_120_440, follows: 6_900, categories: ['decoration'], iconUrl: null, updatedAt: 5, createdAt: 7 },
          { projectId: 'mOgUt4GM', slug: 'modmenu', title: 'Mod Menu', description: 'Экран списка модов с конфигами внутри игры.', downloads: 28_731_910, follows: 19_750, categories: ['utility'], iconUrl: null, updatedAt: 6, createdAt: 6 },
          { projectId: 'gu7yAYhd', slug: 'ferritecore', title: 'FerriteCore', description: 'Снижение потребления памяти без потери производительности.', downloads: 17_204_300, follows: 8_100, categories: ['optimization'], iconUrl: null, updatedAt: 4, createdAt: 8 },
          { projectId: 'uXXizFIs', slug: 'entityculling', title: 'Entity Culling', description: 'Пропуск рендера сущностей вне поля зрения — заметный буст FPS.', downloads: 14_902_110, follows: 7_400, categories: ['optimization'], iconUrl: null, updatedAt: 3, createdAt: 9 },
          { projectId: 'NNAgCjsB', slug: 'rei', title: 'Roughly Enough Items', description: 'Просмотр рецептов и предметов: наследник JEI для Fabric.', downloads: 11_330_500, follows: 9_900, categories: ['utility'], iconUrl: null, updatedAt: 2, createdAt: 10 }
        ];
        const q = (args.query as string).toLowerCase();
        let hits = q ? all.filter((h) => h.title.toLowerCase().includes(q) || h.slug.includes(q)) : [...all];
        const sort = (args.sort as string) ?? 'relevance';
        if (sort === 'downloads') hits.sort((a, b) => b.downloads - a.downloads);
        if (sort === 'updated') hits.sort((a, b) => b.updatedAt - a.updatedAt);
        if (sort === 'newest') hits.sort((a, b) => b.createdAt - a.createdAt);
        const offset = (args.offset as number) ?? 0;
        return Promise.resolve({ hits: hits.slice(offset, offset + 20), totalHits: hits.length });
      }
      case 'ai:analyze': {
        if (!mockSettings.groqApiKey.trim()) {
          return Promise.reject(new Error('нет api-ключа · настройки → ии'));
        }
        const lines = args.lines as string[];
        const hasError = lines.some((l) => l.includes('[ERROR]') || /Exception|OutOfMemory/i.test(l));
        const text = hasError
          ? [
              'ДИАГНОЗ: краш при инициализации — игра не смогла получить скин в оффлайн-режиме и упала на старых модах.',
              'ПРИЧИНА: сетевой таймаут не фатален, но в логе есть Exception от несовместимого мода.',
              'РЕШЕНИЕ:',
              '1. Открой папку mods инстанса и убери последний добавленный мод.',
              '2. Проверь, что версии модов совпадают с версией игры.',
              '3. Подними RAM до 6G в настройках, если есть OutOfMemoryError.',
              '4. Перезапусти через PLAY и смотри первый ERROR в логе.'
            ].join('\n')
          : 'Лог чистый: ошибок не найдено, процесс работает штатно.';
        return new Promise((resolve) => setTimeout(() => resolve({ text }), 1200));
      }
      case 'modrinth:install': {
        mockInstances = mockInstances.map((i) =>
          i.id === args.instanceId ? { ...i, modsCount: i.modsCount + 1 } : i
        );
        const slug = args.projectId as string;
        const list = mockModFiles.get(args.instanceId as string) ?? [];
        mockModFiles.set(args.instanceId as string, [...list, `${slug.toLowerCase()}-1.21.4-1.0.0.jar`]);
        return Promise.resolve(undefined);
      }
      case 'mods:listFiles':
        return Promise.resolve(mockModFiles.get(args.instanceId as string) ?? []);
      case 'mods:deleteFile': {
        const cur = mockModFiles.get(args.instanceId as string) ?? [];
        mockModFiles.set(args.instanceId as string, cur.filter((f) => f !== args.filename));
        mockInstances = mockInstances.map((i) =>
          i.id === args.instanceId ? { ...i, modsCount: Math.max(0, i.modsCount - 1) } : i
        );
        return Promise.resolve(undefined);
      }
      case 'app:openDir':
        return Promise.resolve(undefined);
      case 'win:minimize':
      case 'win:maximize':
      case 'win:close':
        return Promise.resolve(undefined);
      default:
        return Promise.reject(new Error(`mock: unknown channel ${channel}`));
    }
  }) as AkyBridge['invoke'],
  on: (channel, listener) => {
    if (!listeners.has(channel)) listeners.set(channel, new Set());
    listeners.get(channel)!.add(listener as Listener);
    return () => listeners.get(channel)?.delete(listener as Listener);
  }
};

export const aky: AkyBridge = window.aky ?? mockBridge;
export const isElectron = Boolean(window.aky);
