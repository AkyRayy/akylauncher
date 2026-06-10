import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface FileTask {
  url: string;
  dest: string;
  sha1?: string;
  size?: number;
}

export interface PoolProgress {
  done: number;
  total: number;
  bytes: number;
}

async function sha1Of(path: string): Promise<string> {
  const buf = await readFile(path);
  return createHash('sha1').update(buf).digest('hex');
}

async function isFresh(task: FileTask): Promise<boolean> {
  try {
    const st = await stat(task.dest);
    if (task.size !== undefined && st.size !== task.size) return false;
    if (task.sha1) return (await sha1Of(task.dest)) === task.sha1;
    return st.size > 0;
  } catch {
    return false;
  }
}

export const USER_AGENT = 'AkyLauncher/1.0.0-beta (github.com/AkyRayy/akylauncher)';

const HEADERS = { 'User-Agent': USER_AGENT };

async function fetchOne(task: FileTask, retries = 3): Promise<number> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(task.url, { headers: HEADERS });
      if (!res.ok) throw new Error(`http ${res.status} ${task.url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (task.sha1) {
        const got = createHash('sha1').update(buf).digest('hex');
        if (got !== task.sha1) throw new Error(`sha1 mismatch ${task.url}`);
      }
      await mkdir(dirname(task.dest), { recursive: true });
      await writeFile(task.dest, buf);
      return buf.length;
    } catch (err) {
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
}

export async function downloadAll(
  tasks: FileTask[],
  concurrency = 8,
  onProgress?: (p: PoolProgress) => void
): Promise<void> {
  const queue = [...tasks];
  let done = 0;
  let bytes = 0;
  const total = tasks.length;

  async function worker(): Promise<void> {
    for (;;) {
      const task = queue.shift();
      if (!task) return;
      if (!(await isFresh(task))) {
        bytes += await fetchOne(task);
      }
      done++;
      onProgress?.({ done, total, bytes });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
}

export async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`http ${res.status} ${url}`);
  return res.json();
}
