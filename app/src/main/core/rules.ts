import type { ConditionalArg, Library, OsRule } from './mojang-schemas';

export interface OsInfo {
  name: 'windows' | 'linux' | 'osx';
  arch: string;
}

export function currentOs(): OsInfo {
  const platform = process.platform;
  const name = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'osx' : 'linux';
  return { name, arch: process.arch };
}

export function rulesAllow(rules: OsRule[] | undefined, os: OsInfo, features: Record<string, boolean> = {}): boolean {
  if (!rules || rules.length === 0) return true;
  let allowed = false;
  for (const rule of rules) {
    let matches = true;
    if (rule.os?.name && rule.os.name !== os.name) matches = false;
    if (rule.os?.arch && rule.os.arch !== os.arch) matches = false;
    if (rule.features) {
      for (const [key, want] of Object.entries(rule.features)) {
        if ((features[key] ?? false) !== want) matches = false;
      }
    }
    if (matches) allowed = rule.action === 'allow';
  }
  return allowed;
}

export function filterLibraries(libraries: Library[], os: OsInfo): Library[] {
  return libraries.filter((lib) => rulesAllow(lib.rules, os));
}

export function flattenArgs(
  args: ConditionalArg[] | undefined,
  os: OsInfo,
  features: Record<string, boolean> = {}
): string[] {
  if (!args) return [];
  const out: string[] = [];
  for (const arg of args) {
    if (typeof arg === 'string') {
      out.push(arg);
      continue;
    }
    if (rulesAllow(arg.rules, os, features)) {
      if (typeof arg.value === 'string') out.push(arg.value);
      else out.push(...arg.value);
    }
  }
  return out;
}

export function substitute(args: string[], vars: Record<string, string>): string[] {
  return args.map((a) => a.replace(/\$\{(\w+)\}/g, (m, key: string) => vars[key] ?? m));
}

export function mavenToPath(coord: string): string {
  const [group, artifact, version, classifier] = coord.split(':');
  if (!group || !artifact || !version) throw new Error(`bad maven coord: ${coord}`);
  const file = classifier
    ? `${artifact}-${version}-${classifier}.jar`
    : `${artifact}-${version}.jar`;
  return `${group.replace(/\./g, '/')}/${artifact}/${version}/${file}`;
}

export function dedupeLibraries(libs: Library[]): Library[] {
  const seen = new Set<string>();
  return libs.filter((lib) => {
    const p = lib.name.split(':');
    const key = `${p[0]}:${p[1]}:${p[3] ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function libraryRelPath(lib: Library): string | null {
  if (lib.downloads?.artifact?.path) return lib.downloads.artifact.path;
  if (lib.downloads && !lib.downloads.artifact) return null;
  try {
    return mavenToPath(lib.name);
  } catch {
    return null;
  }
}
