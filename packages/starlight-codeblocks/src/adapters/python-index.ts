import { inflateSync } from 'node:zlib';
import type { Resolution } from '../options.ts';

/** Every name in an index, by qualified name. Each resolution has its qualified `name`. */
export type PythonIndex = Map<string, Resolution & { name: string }>;

/**
 * Reads a Sphinx `objects.inv` (version 2) and adds its Python objects to `index`.
 * Relative URIs resolve against `base`. Throws for anything that is not a version 2 inventory.
 */
export function readInventory(data: Uint8Array, base: string, index: PythonIndex = new Map()): PythonIndex {
  const header: string[] = [];
  let offset = 0;
  while (header.length < 4) {
    const end = data.indexOf(10, offset);
    if (end === -1) break;
    header.push(new TextDecoder().decode(data.subarray(offset, end)));
    offset = end + 1;
  }
  if (header[0] !== '# Sphinx inventory version 2') throw new Error('not a Sphinx objects.inv, version 2');
  const project = header[1]?.replace('# Project: ', '') ?? '';
  const version = header[2]?.replace('# Version: ', '') ?? '';
  const source = `${[project, version].filter(Boolean).join(' ')} documentation`;
  for (const line of inflateSync(data.subarray(offset)).toString('utf8').split('\n')) {
    const match = line.match(/^(.+?)\s+py:(\S+)\s+-?\d+\s+(\S*)\s+(.*)$/);
    if (!match) continue;
    const [, name = '', kind, uri = ''] = match;
    if (index.has(name)) continue;
    const href = new URL(uri.endsWith('$') ? uri.slice(0, -1) + name : uri, base).href;
    index.set(name, { name, href, kind, source });
  }
  return index;
}
