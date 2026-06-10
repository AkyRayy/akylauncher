import { Client } from '@xhayper/discord-rpc';
import type { GameState, InstanceConfig } from '@shared/types';

export const DISCORD_CLIENT_ID = '1391234567890123456';
export const TELEGRAM_URL = 'https://t.me/AkyLauncher';

let client: Client | null = null;
let connected = false;
let retryTimer: NodeJS.Timeout | null = null;
let launcherStartedAt = Date.now();

interface PresenceCtx {
  game: GameState;
  instance: InstanceConfig | null;
  nickname: string | null;
}

let lastCtx: PresenceCtx = { game: { running: false, pid: null, instanceId: null, startedAt: null }, instance: null, nickname: null };

export function buildActivity(ctx: PresenceCtx) {
  const buttons = [{ label: 'Присоединиться', url: TELEGRAM_URL }];

  if (ctx.game.running && ctx.instance) {
    const mods =
      ctx.instance.modsCount > 0 ? ` · ${ctx.instance.modsCount} модов` : '';
    return {
      details: `Играет · ${ctx.instance.name}`,
      state: `Minecraft ${ctx.instance.mcVersion} · ${ctx.instance.loader}${mods}`,
      startTimestamp: ctx.game.startedAt ?? Date.now(),
      largeImageKey: 'logo',
      largeImageText: 'AkyLauncher',
      smallImageKey: 'play',
      smallImageText: ctx.nickname ?? 'offline',
      buttons
    };
  }
  return {
    details: 'В лаунчере',
    state: ctx.instance
      ? `Профиль · ${ctx.instance.name} · ${ctx.instance.mcVersion}`
      : 'Выбирает профиль',
    startTimestamp: launcherStartedAt,
    largeImageKey: 'logo',
    largeImageText: 'AkyLauncher · RAW BLOCK',
    buttons
  };
}

async function push(): Promise<void> {
  if (!client || !connected) return;
  try {
    await client.user?.setActivity(buildActivity(lastCtx));
  } catch {
    connected = false;
    scheduleRetry();
  }
}

function scheduleRetry(): void {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void connect();
  }, 30_000);
}

async function connect(): Promise<void> {
  try {
    client = new Client({ clientId: DISCORD_CLIENT_ID });
    client.on('ready', () => {
      connected = true;
      void push();
    });
    client.on('disconnected', () => {
      connected = false;
      scheduleRetry();
    });
    await client.login();
  } catch {
    connected = false;
    client = null;
    scheduleRetry();
  }
}

export function initDiscordRpc(): void {
  launcherStartedAt = Date.now();
  void connect();
}

export function updatePresence(ctx: Partial<PresenceCtx>): void {
  lastCtx = { ...lastCtx, ...ctx };
  void push();
}

export async function destroyDiscordRpc(): Promise<void> {
  if (retryTimer) clearTimeout(retryTimer);
  try {
    await client?.destroy();
  } catch {
    /* discord закрыт */
  }
  client = null;
  connected = false;
}
