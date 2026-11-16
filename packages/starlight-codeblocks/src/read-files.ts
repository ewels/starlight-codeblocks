import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getRegistry } from './registry.ts';

/*
 * The files that code blocks read at build time, such as `runnable.outputFile`, with the pages that read them. The
 * content layer keeps rendered Markdown across builds until its digest of the Astro config changes, and a change to one
 * of these files does not change that digest. So the list is saved in the cache folder, and the next build puts the
 * contents of the files in the digest.
 */

const listFile = (cacheDir: string) => join(cacheDir, 'starlight-codeblocks', 'read-files.json');

export function loadReadFiles(cacheDir: string): Map<string, Set<string>> {
  try {
    const saved = JSON.parse(readFileSync(listFile(cacheDir), 'utf8')) as Record<string, string[]>;
    return new Map(Object.entries(saved).map(([file, pages]) => [file, new Set(pages)]));
  } catch {
    return new Map();
  }
}

/** Records that `page` reads `file`. */
export function trackReadFile(file: string, page: string) {
  const registry = getRegistry();
  const files = registry?.readFiles;
  if (!files) return;
  const pages = files.get(file) ?? new Set<string>();
  if (pages.has(page)) return;
  files.set(file, pages.add(page));
  if (registry.cacheDir) {
    const list = listFile(registry.cacheDir);
    mkdirSync(dirname(list), { recursive: true });
    writeFileSync(list, JSON.stringify(Object.fromEntries([...files].map(([f, p]) => [f, [...p]]))));
  }
  registry.watchFile?.(file);
}

/** A hash of the contents of `files`. A missing file counts as empty. */
export function readFilesDigest(files: Iterable<string>) {
  const hash = createHash('sha256');
  for (const file of [...files].sort()) {
    hash.update(`${file}\0`);
    try {
      hash.update(readFileSync(file));
    } catch {}
    hash.update('\0');
  }
  return hash.digest('base64url').slice(0, 16);
}
