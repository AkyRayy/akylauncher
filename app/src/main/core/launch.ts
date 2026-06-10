import { spawn, type ChildProcess } from 'node:child_process';
import { join, delimiter } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { dirs } from './paths';
import { currentOs, dedupeLibraries, filterLibraries, flattenArgs, libraryRelPath, substitute } from './rules';
import type { VersionJson } from './mojang-schemas';
import type { Session } from './auth';
import type { GameLogLine, GameState, InstanceConfig } from '@shared/types';

export interface LaunchPlan {
  javaPath: string;
  args: string[];
  cwd: string;
}

export interface BuildCtx {
  vjson: VersionJson;
  versionId: string;
  session: Session;
  instance: InstanceConfig;
  paths: {
    librariesDir: string;
    versionJar: string;
    nativesDir: string;
    assetsDir: string;
    gameDir: string;
  };
  os: ReturnType<typeof currentOs>;
}

export function buildLaunchArgs(ctx: BuildCtx): string[] {
  const { vjson, session, instance, paths, os } = ctx;

  const libs = dedupeLibraries(filterLibraries(vjson.libraries, os));
  const cpEntries = libs
    .map((l) => libraryRelPath(l))
    .filter((p): p is string => Boolean(p))
    .map((p) => join(paths.librariesDir, p));
  cpEntries.push(paths.versionJar);
  const classpath = cpEntries.join(delimiter);

  const vars: Record<string, string> = {
    auth_player_name: session.nickname,
    auth_uuid: session.uuid,
    auth_access_token: session.accessToken,
    auth_session: session.accessToken,
    user_type: session.userType,
    user_properties: '{}',
    version_name: ctx.versionId,
    version_type: vjson.type,
    game_directory: paths.gameDir,
    assets_root: paths.assetsDir,
    assets_index_name: vjson.assetIndex?.id ?? vjson.assets ?? 'legacy',
    natives_directory: paths.nativesDir,
    launcher_name: 'AkyLauncher',
    launcher_version: '1.0.0-beta',
    classpath,
    resolution_width: String(instance.windowWidth),
    resolution_height: String(instance.windowHeight)
  };

  const jvm: string[] = [`-Xmx${instance.ramMb}M`, `-Xms${Math.min(instance.ramMb, 1024)}M`, ...instance.jvmArgs];

  if (vjson.arguments?.jvm) {
    jvm.push(...substitute(flattenArgs(vjson.arguments.jvm, os), vars));
  } else {
    jvm.push(`-Djava.library.path=${paths.nativesDir}`, '-cp', classpath);
  }

  let game: string[];
  if (vjson.arguments?.game) {
    game = substitute(flattenArgs(vjson.arguments.game, os), vars);
  } else if (vjson.minecraftArguments) {
    game = substitute(vjson.minecraftArguments.split(' '), vars);
  } else {
    game = [];
  }

  return [...jvm, vjson.mainClass, ...game];
}

let child: ChildProcess | null = null;
let state: GameState = { running: false, pid: null, instanceId: null, startedAt: null };

export function gameState(): GameState {
  return state;
}

export function killGame(): void {
  child?.kill('SIGKILL');
}

function classify(line: string): GameLogLine['level'] {
  if (/\b(ERROR|FATAL|Exception|at .+\(.+\.java)/.test(line)) return 'ERROR';
  if (/\bWARN/.test(line)) return 'WARN';
  if (/\bDEBUG/.test(line)) return 'DEBUG';
  return 'INFO';
}

export async function spawnGame(
  instance: InstanceConfig,
  vjson: VersionJson,
  versionId: string,
  session: Session,
  javaPath: string,
  onLog: (l: GameLogLine) => void,
  onState: (s: GameState) => void,
  extraJvmArgs: string[] = []
): Promise<number> {
  if (state.running) throw new Error('игра уже запущена');

  await mkdir(dirs.instanceDir(instance.id), { recursive: true });
  await mkdir(dirs.natives(instance.mcVersion), { recursive: true });

  const built = buildLaunchArgs({
    vjson,
    versionId,
    session,
    instance,
    os: currentOs(),
    paths: {
      librariesDir: dirs.libraries(),
      versionJar: join(dirs.versionDir(instance.mcVersion), `${instance.mcVersion}.jar`),
      nativesDir: dirs.natives(instance.mcVersion),
      assetsDir: dirs.assets(),
      gameDir: dirs.instanceDir(instance.id)
    }
  });
  const args = [...extraJvmArgs, ...built];

  const proc = spawn(javaPath, args, { cwd: dirs.instanceDir(instance.id) });
  child = proc;
  state = { running: true, pid: proc.pid ?? null, instanceId: instance.id, startedAt: Date.now() };
  onState(state);

  proc.on('error', (err) => {
    onLog({ ts: Date.now(), level: 'ERROR', text: `spawn failed · ${err.message}` });
    child = null;
    state = { running: false, pid: null, instanceId: null, startedAt: null };
    onState(state);
  });

  const feed = (chunk: Buffer) => {
    for (const raw of chunk.toString('utf8').split('\n')) {
      const text = raw.trimEnd();
      if (text) onLog({ ts: Date.now(), level: classify(text), text });
    }
  };
  proc.stdout?.on('data', feed);
  proc.stderr?.on('data', feed);
  proc.on('exit', (code) => {
    onLog({ ts: Date.now(), level: code === 0 ? 'INFO' : 'WARN', text: `process exited · code ${code}` });
    child = null;
    state = { running: false, pid: null, instanceId: null, startedAt: null };
    onState(state);
  });

  return proc.pid ?? -1;
}
