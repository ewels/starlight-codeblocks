import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
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

interface GriffeObject {
  kind: string;
  name?: string;
  path: string;
  target_path?: string;
  docstring?: { value?: string };
  parameters?: { name: string; kind: string; annotation: unknown; default: string | null }[];
  returns?: unknown;
  annotation?: unknown;
  members?: Record<string, GriffeObject>;
}

/** Writes a Griffe expression, such as an annotation, as source text. */
function expression(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  const e = value as Record<string, unknown>;
  const list = (items: unknown) => (Array.isArray(items) ? items.map(expression) : []);
  switch (e.cls) {
    case 'ExprName':
      return String(e.name);
    case 'ExprAttribute':
      return list(e.values).join('.');
    case 'ExprBinOp':
      return `${expression(e.left)} ${e.operator} ${expression(e.right)}`;
    case 'ExprSubscript':
      return `${expression(e.left)}[${expression(e.slice)}]`;
    case 'ExprTuple':
      return list(e.elements).join(', ');
    case 'ExprList':
      return `[${list(e.elements).join(', ')}]`;
    default:
      return list(e.elements ?? e.values).join(', ') || String(e.value ?? '');
  }
}

function parameters(object: GriffeObject, method: boolean) {
  const params = [...(object.parameters ?? [])];
  if (method && ['self', 'cls'].includes(params[0]?.name ?? '')) params.shift();
  const out: string[] = [];
  let star = false;
  params.forEach((p, i) => {
    const annotation = expression(p.annotation);
    const dflt = p.default === null ? '' : annotation ? ` = ${p.default}` : `=${p.default}`;
    const text = `${p.name}${annotation ? `: ${annotation}` : ''}${dflt}`;
    if (p.kind === 'variadic positional') {
      star = true;
      out.push(`*${text}`);
    } else if (p.kind === 'variadic keyword') {
      out.push(`**${text}`);
    } else {
      if (p.kind === 'keyword-only' && !star) {
        star = true;
        out.push('*');
      }
      out.push(text);
    }
    if (p.kind === 'positional-only' && params[i + 1]?.kind !== 'positional-only') out.push('/');
  });
  return out.join(', ');
}

function signature(object: GriffeObject, parent?: GriffeObject) {
  const method = parent?.kind === 'class';
  const name = method ? `${parent.name ?? ''}.${object.name}` : object.path;
  if (object.kind === 'function') {
    const returns = expression(object.returns);
    return `${name}(${parameters(object, method)})${returns ? ` -> ${returns}` : ''}`;
  }
  if (object.kind === 'class') {
    const init = object.members?.__init__;
    return `class ${object.path}${init ? `(${parameters(init, true)})` : ''}`;
  }
  if (object.kind === 'attribute') {
    const annotation = expression(object.annotation);
    return annotation ? `${name}: ${annotation}` : undefined;
  }
  return undefined;
}

/** The first sentence of the first paragraph of a docstring. */
export function firstSentence(text = '') {
  const paragraph = (text.trim().split(/\n\s*\n/)[0] ?? '').replace(/\s+/g, ' ');
  return paragraph.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? paragraph;
}

/**
 * Adds the public objects of a Griffe dump to `index`, with starlight-pydocs URLs: one page for each
 * module at `/<base>/<module path after the package>/`, and the dotted path as the anchor.
 */
export function readGriffeDump(dump: Record<string, GriffeObject>, pkg: string, base: string, index: PythonIndex) {
  const root = base.replace(/^\/+|\/+$/g, '');
  const source = `${pkg} API reference`;
  const aliases = new Map<string, string>();
  const add = (object: GriffeObject, page: string, parent?: GriffeObject) => {
    const href = object.kind === 'module' ? page : `${page}#${object.path}`;
    const kind = parent?.kind === 'class' && object.kind === 'function' ? 'method' : object.kind;
    const summary = firstSentence(object.docstring?.value) || undefined;
    index.set(object.path, { name: object.path, href, kind, signature: signature(object, parent), summary, source });
    for (const [name, member] of Object.entries(object.members ?? {})) {
      if (name.startsWith('_')) continue;
      if (member.kind === 'alias') {
        if (member.target_path) aliases.set(member.path, member.target_path);
      } else if (member.kind === 'module') {
        const rest = member.path.split('.').slice(1).join('/');
        add(member, `/${[root, rest].filter(Boolean).join('/')}/`);
      } else {
        add(member, page, object);
      }
    }
  };
  const top = dump[pkg];
  if (!top) throw new Error(`the dump has no package \`${pkg}\``);
  add(top, `/${root}/`);
  for (const [alias, target] of aliases) {
    const entry = index.get(target);
    if (entry && !index.has(alias)) index.set(alias, entry);
  }
  return index;
}

/** The newest `starlight-pydocs/<package>-<hash>/dump.json` in Astro's cache folder. */
export function findPydocsDump(cacheDir: string, pkg: string) {
  const dir = join(cacheDir, 'starlight-pydocs');
  if (!existsSync(dir)) return undefined;
  return readdirSync(dir)
    .filter((name) => name.startsWith(`${pkg}-`))
    .map((name) => join(dir, name, 'dump.json'))
    .filter((file) => existsSync(file))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

export function readPydocs(
  { package: pkg, base = `api/${pkg}`, dump }: { package: string; base?: string; dump?: string },
  context: { root: string; cacheDir: string },
  index: PythonIndex,
) {
  const file = dump ? resolve(context.root, dump) : findPydocsDump(context.cacheDir, pkg);
  if (!file) {
    throw new Error(
      `found no starlight-pydocs data for \`${pkg}\` in ${join(context.cacheDir, 'starlight-pydocs')}. Add starlight-pydocs to the site, or give the dump path in \`dump\`.`,
    );
  }
  readGriffeDump(JSON.parse(readFileSync(file, 'utf8')), pkg, base, index);
}
