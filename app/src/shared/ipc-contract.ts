import type {
  AppSettings,
  DownloadProgress,
  GameLogLine,
  GameState,
  InstanceConfig,
  JavaRuntime,
  LoaderKind,
  ModSort,
  ModrinthSearchResult,
  ProfileConfig,
  UpdateInfo,
  VersionSummary
} from './types';

export interface AkyApi {
  'versions:list': (args: { force?: boolean }) => Promise<VersionSummary[]>;
  'versions:install': (args: { versionId: string }) => Promise<{ taskId: string }>;

  'instances:list': () => Promise<InstanceConfig[]>;
  'instances:create': (args: {
    name: string;
    mcVersion: string;
    loader: LoaderKind;
  }) => Promise<InstanceConfig>;
  'instances:update': (args: { id: string; patch: Partial<InstanceConfig> }) => Promise<InstanceConfig>;
  'instances:delete': (args: { id: string }) => Promise<void>;
  'instances:export': (args: { id: string }) => Promise<{ ok: boolean; path: string | null; files: number }>;

  'profiles:list': () => Promise<ProfileConfig[]>;
  'profiles:createOffline': (args: { nickname: string }) => Promise<ProfileConfig>;
  'profiles:setActive': (args: { id: string }) => Promise<void>;
  'profiles:delete': (args: { id: string }) => Promise<void>;
  'profiles:setSkin': (args: { id: string }) => Promise<{ ok: boolean }>;
  'profiles:getSkin': (args: { id: string }) => Promise<{ dataUrl: string | null }>;
  'profiles:clearSkin': (args: { id: string }) => Promise<void>;

  'java:list': () => Promise<JavaRuntime[]>;
  'java:ensure': (args: { major: number }) => Promise<JavaRuntime>;

  'game:launch': (args: { instanceId: string }) => Promise<{ pid: number }>;
  'game:kill': () => Promise<void>;
  'game:state': () => Promise<GameState>;

  'settings:get': () => Promise<AppSettings>;
  'settings:set': (args: { patch: Partial<AppSettings> }) => Promise<AppSettings>;

  'modrinth:search': (args: {
    query: string;
    mcVersion: string;
    loader: LoaderKind;
    offset?: number;
    sort?: ModSort;
  }) => Promise<ModrinthSearchResult>;
  'modrinth:install': (args: { projectId: string; instanceId: string }) => Promise<void>;

  'mods:listFiles': (args: { instanceId: string }) => Promise<string[]>;
  'mods:deleteFile': (args: { instanceId: string; filename: string }) => Promise<void>;

  'ai:analyze': (args: { lines: string[]; context: string }) => Promise<{ text: string }>;

  'app:openDir': (args: { instanceId?: string }) => Promise<void>;
  'app:checkUpdate': () => Promise<UpdateInfo>;
  'app:openTelegram': () => Promise<void>;
  'app:presenceSelect': (args: { instanceId: string | null }) => Promise<void>;

  'win:minimize': () => Promise<void>;
  'win:maximize': () => Promise<void>;
  'win:close': () => Promise<void>;
}

export interface AkyEvents {
  'evt:download-progress': DownloadProgress;
  'evt:game-log': GameLogLine;
  'evt:game-state': GameState;
}

export type AkyChannel = keyof AkyApi;
export type AkyEventChannel = keyof AkyEvents;

export interface AkyBridge {
  invoke<C extends AkyChannel>(
    channel: C,
    ...args: Parameters<AkyApi[C]>
  ): ReturnType<AkyApi[C]>;
  on<E extends AkyEventChannel>(
    channel: E,
    listener: (payload: AkyEvents[E]) => void
  ): () => void;
}
