import { create } from 'zustand';
import { aky } from '../bridge';
import type {
  AppSettings,
  DownloadProgress,
  GameLogLine,
  GameState,
  InstanceConfig,
  ProfileConfig,
  VersionSummary
} from '@shared/types';

export type Screen = 'home' | 'versions' | 'profiles' | 'mods' | 'settings' | 'console';

interface AppState {
  screen: Screen;
  versions: VersionSummary[];
  instances: InstanceConfig[];
  profiles: ProfileConfig[];
  settings: AppSettings | null;
  selectedInstanceId: string | null;
  progress: DownloadProgress | null;
  game: GameState;
  log: GameLogLine[];
  error: string | null;

  setScreen: (s: Screen) => void;
  selectInstance: (id: string) => void;
  setError: (e: string | null) => void;
  clearLog: () => void;
  refresh: () => Promise<void>;
  init: () => Promise<void>;
}

export const useApp = create<AppState>((set, get) => ({
  screen: 'home',
  versions: [],
  instances: [],
  profiles: [],
  settings: null,
  selectedInstanceId: null,
  progress: null,
  game: { running: false, pid: null, instanceId: null, startedAt: null },
  log: [],
  error: null,

  setScreen: (screen) => set({ screen }),
  selectInstance: (selectedInstanceId) => {
    set({ selectedInstanceId });
    void aky.invoke('app:presenceSelect', { instanceId: selectedInstanceId });
  },
  setError: (error) => set({ error }),
  clearLog: () => set({ log: [] }),

  refresh: async () => {
    const [instances, profiles, settings] = await Promise.all([
      aky.invoke('instances:list'),
      aky.invoke('profiles:list'),
      aky.invoke('settings:get')
    ]);
    const sel = get().selectedInstanceId;
    const nextSel = sel && instances.some((i) => i.id === sel) ? sel : instances[0]?.id ?? null;
    set({ instances, profiles, settings, selectedInstanceId: nextSel });
    void aky.invoke('app:presenceSelect', { instanceId: nextSel });
  },

  init: async () => {
    aky.on('evt:download-progress', (p) => {
      set({ progress: p.phase === 'done' ? null : p });
      if (p.phase === 'done') void get().refresh().then(() => loadVersions(set));
      if (p.phase === 'error') set({ error: p.message, progress: null });
    });
    aky.on('evt:game-log', (l) =>
      set((s) => ({ log: s.log.length > 2000 ? [...s.log.slice(-1500), l] : [...s.log, l] }))
    );
    aky.on('evt:game-state', (game) => set({ game }));

    await get().refresh();
    await loadVersions(set);
  }
}));

async function loadVersions(set: (p: Partial<AppState>) => void): Promise<void> {
  try {
    set({ versions: await aky.invoke('versions:list', {}) });
  } catch {
    set({ error: 'манифест недоступен · проверь сеть' });
  }
}
