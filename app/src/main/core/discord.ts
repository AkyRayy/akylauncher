import { Client } from '@xhayper/discord-rpc';
import type { GameState, InstanceConfig } from '@shared/types';

export const DISCORD_CLIENT_ID = '1514371704447701062';
export const TELEGRAM_URL = 'https://t.me/AkyLauncher';

export type RpcStatus = 'connecting' | 'connected' | 'unavailable';

let client: Client | null = null;
let connected = false;
let retryTimer: NodeJS.Timeout | null = null;
let launcherStartedAt = Date.now();
let status: RpcStatus = 'connecting';
let lastError: string | null = null;
let statusListener: ((s: RpcStatus, err: string | null) => void) | null = null;

function setStatus(next: RpcStatus, err: string | null = null): void {
  status = next;
  lastError = err;
  statusListener?.(next, err);
}

export function onRpcStatus(cb: (s: RpcStatus, err: string | null) => void): void {
  statusListener = cb;
  cb(status, lastError);
}

export function rpcStatus(): { status: RpcStatus; error: string | null } {
  return { status, error: lastError };
}

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
  } catch (err) {
    connected = false;
    setStatus('unavailable', `setActivity · ${(err as Error).message}`);
    scheduleRetry();
  }
}

function scheduleRetry(): void {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void connect();
  }, 15_000);
}

async function connect(): Promise<void> {
  setStatus('connecting');
  try {
    client = new Client({ clientId: DISCORD_CLIENT_ID });
    client.on('ready', () => {
      connected = true;
      setStatus('connected');
      void push();
    });
    client.on('disconnected', () => {
      connected = false;
      setStatus('unavailable', 'discord отключился');
      scheduleRetry();
    });
    await client.login();
  } catch (err) {
    connected = false;
    client = null;
    setStatus('unavailable', (err as Error).message || 'discord не запущен');
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
