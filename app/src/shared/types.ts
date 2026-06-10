
export type LoaderKind = 'vanilla' | 'fabric' | 'quilt' | 'forge' | 'neoforge';

export type VersionKind = 'release' | 'snapshot' | 'old_beta' | 'old_alpha';

export interface VersionSummary {
  id: string;
  kind: VersionKind;
  url: string;
  releaseTime: string;
  installed: boolean;
}

export interface InstanceConfig {
  id: string;
  name: string;
  mcVersion: string;
  loader: LoaderKind;
  loaderVersion: string | null;
  createdAt: string;
  lastPlayedAt: string | null;
  ramMb: number;
  javaPath: string | null;
  jvmArgs: string[];
  windowWidth: number;
  windowHeight: number;
  modsCount: number;
}

export interface ProfileConfig {
  id: string;
  nickname: string;
  uuid: string;
  kind: 'offline' | 'elyby';
  active: boolean;
  skinPath: string | null;
}

export interface UpdateInfo {
  available: boolean;
  current: string;
  latest: string | null;
  url: string | null;
}

export interface JavaRuntime {
  path: string;
  version: string;
  major: number;
  source: 'system' | 'managed';
}

export interface AppSettings {
  gameDir: string;
  defaultRamMb: number;
  maxRamMb: number;
  jvmArgs: string[];
  windowWidth: number;
  windowHeight: number;
  keepLauncherOpen: boolean;
  groqApiKey: string;
  skinsInGame: boolean;
}

export type ModSort = 'relevance' | 'downloads' | 'newest' | 'updated';

export interface DownloadProgress {
  taskId: string;
  label: string;
  ratio: number;
  done: number;
  total: number;
  speedBps: number;
  phase: 'manifest' | 'client' | 'libraries' | 'assets' | 'java' | 'loader' | 'done' | 'error';
  message: string;
}

export interface GameLogLine {
  ts: number;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  text: string;
}

export interface GameState {
  running: boolean;
  pid: number | null;
  instanceId: string | null;
  startedAt: number | null;
}

export interface ModrinthHit {
  projectId: string;
  slug: string;
  title: string;
  description: string;
  downloads: number;
  follows: number;
  categories: string[];
  iconUrl: string | null;
}

export interface ModrinthSearchResult {
  hits: ModrinthHit[];
  totalHits: number;
}
