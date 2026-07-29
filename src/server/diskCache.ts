import { promises as fs } from 'fs';
import path from 'path';

/**
 * Tiny disk cache for fixed lines — synthesized audio and the cached intro —
 * so repeat plays never re-bill the AI APIs. Lives in .tts-cache/ (gitignored).
 * Every failure falls through to null: caching is never load-bearing.
 */
const DIR = path.join(process.cwd(), '.tts-cache');

export async function readCacheFile(name: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(DIR, name));
  } catch {
    return null;
  }
}

export async function writeCacheFile(name: string, data: Buffer | string): Promise<void> {
  try {
    await fs.mkdir(DIR, { recursive: true });
    // Write to a temp name, then rename: readCacheFile serves any non-empty
    // file forever, so a process killed mid-write must never be able to
    // leave a half-written file behind under the real name.
    const tmp = path.join(DIR, `.${name}.${process.pid}.tmp`);
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, path.join(DIR, name));
  } catch {}
}
