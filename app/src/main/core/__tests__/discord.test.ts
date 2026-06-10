import { describe, expect, it } from 'vitest';
import { buildActivity, TELEGRAM_URL } from '../discord';
import type { GameState, InstanceConfig } from '@shared/types';

const inst: InstanceConfig = {
  id: 'i1', name: 'SURVIVAL MAIN', mcVersion: '1.21.4', loader: 'fabric',
  loaderVersion: null, createdAt: '', lastPlayedAt: null, ramMb: 4096,
  javaPath: null, jvmArgs: [], windowWidth: 1280, windowHeight: 720, modsCount: 14
};

const idle: GameState = { running: false, pid: null, instanceId: null, startedAt: null };
const running: GameState = { running: true, pid: 1, instanceId: 'i1', startedAt: 1700000000000 };

describe('buildActivity', () => {
  it('в лаунчере: профиль и версия в state', () => {
    const a = buildActivity({ game: idle, instance: inst, nickname: 'Aky' });
    expect(a.details).toBe('В лаунчере');
    expect(a.state).toContain('SURVIVAL MAIN');
    expect(a.state).toContain('1.21.4');
  });

  it('без профиля: заглушка', () => {
    const a = buildActivity({ game: idle, instance: null, nickname: null });
    expect(a.state).toBe('Выбирает профиль');
  });

  it('в игре: версия, лоадер, моды, таймер от старта игры', () => {
    const a = buildActivity({ game: running, instance: inst, nickname: 'Aky' });
    expect(a.details).toBe('Играет · SURVIVAL MAIN');
    expect(a.state).toBe('Minecraft 1.21.4 · fabric · 14 модов');
    expect(a.startTimestamp).toBe(1700000000000);
    expect(a.smallImageText).toBe('Aky');
  });

  it('0 модов — счётчик не показывается', () => {
    const a = buildActivity({ game: running, instance: { ...inst, modsCount: 0 }, nickname: null });
    expect(a.state).toBe('Minecraft 1.21.4 · fabric');
  });

  it('кнопка Присоединиться ведёт в тгк всегда', () => {
    for (const ctx of [
      { game: idle, instance: null, nickname: null },
      { game: running, instance: inst, nickname: 'Aky' }
    ]) {
      const a = buildActivity(ctx);
      expect(a.buttons).toEqual([{ label: 'Присоединиться', url: TELEGRAM_URL }]);
    }
    expect(TELEGRAM_URL).toBe('https://t.me/AkyLauncher');
  });
});
