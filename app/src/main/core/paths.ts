import { app } from 'electron';
import { join } from 'node:path';

export function rootDir(): string {
  return join(app.getPath('userData'), 'game');
}
export const dirs = {
  root: () => rootDir(),
  versions: () => join(rootDir(), 'versions'),
  versionDir: (id: string) => join(rootDir(), 'versions', id),
  libraries: () => join(rootDir(), 'libraries'),
  assets: () => join(rootDir(), 'assets'),
  natives: (id: string) => join(rootDir(), 'natives', id),
  instances: () => join(rootDir(), 'instances'),
  instanceDir: (id: string) => join(rootDir(), 'instances', id),
  java: () => join(rootDir(), 'java'),
  config: () => app.getPath('userData')
};
