import { rmSync } from 'node:fs';
import { fetchCacheDir } from '../src/expressive-code/api-links.ts';

// Fetched files from an earlier run would hide changes to the fixtures.
export default function clearFetchCache() {
  rmSync(fetchCacheDir(process.cwd()), { recursive: true, force: true });
}
