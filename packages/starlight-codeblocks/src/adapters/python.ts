import type { Root } from '@expressive-code/core/hast';
import type { AdapterContext, ApiLinkAdapter, Resolution, SymbolRef } from '../options.ts';
import { type PythonIndex, readInventory } from './python-index.ts';
import { parsePage, sphinxSummary } from './sphinx-summary.ts';
import { skipBrackets, stringEnd } from './tokens.ts';

export interface PythonInventory {
  /** The URL of a Sphinx `objects.inv`. */
  url: string;
  /** The URL that relative links in the inventory start from. The default is the folder of `url`. */
  base?: string;
}

export interface PythonAdapterOptions {
  /** Link names from the Python standard library. The default is `true`. */
  stdlib?: boolean;
  /** More Sphinx inventories, such as `https://numpy.org/doc/stable/objects.inv`. */
  inventories?: (string | PythonInventory)[];
  /** Fetch the documentation page of each linked name for a short summary on the card. The default is `true`. */
  summaries?: boolean;
}

/** What starlight-pydocs publishes at `globalThis[Symbol.for('starlight-pydocs')]`. */
export interface PydocsRegistry {
  version: 1;
  packages: { name: string; base: string; symbols: Map<string, PydocsSymbol> }[];
}

export interface PydocsSymbol {
  /** Root-relative, without Astro's `base`. */
  href: string;
  kind: 'module' | 'class' | 'function' | 'method' | 'attribute';
  signature?: string;
  summary?: string;
}

const PYDOCS = Symbol.for('starlight-pydocs');

const pydocsRegistry = () => {
  const registry = (globalThis as { [PYDOCS]?: PydocsRegistry })[PYDOCS];
  return registry?.version === 1 ? registry : undefined;
};

/**
 * The object at `path` in the starlight-pydocs package at `base`, or else in the first package that has it.
 * Read on each call, so that dev re-extraction shows.
 */
function pydocsEntry(path: string, base?: string): (Resolution & { name: string }) | undefined {
  const registry = pydocsRegistry();
  if (!registry) return undefined;
  const preferred = registry.packages.filter((pkg) => pkg.base === base);
  for (const pkg of [...preferred, ...registry.packages]) {
    const symbol = pkg.symbols.get(path);
    if (symbol) return { ...symbol, name: path, source: `${pkg.name} API reference` };
  }
  return undefined;
}

const STDLIB_INVENTORY = { url: 'https://docs.python.org/3/objects.inv', base: 'https://docs.python.org/3/' };

interface Token {
  type: 'name' | 'op' | 'end';
  value: string;
  start: number;
  end: number;
}

const TOKEN =
  /(#[^\n]*)|[rRbBuUfFtT]{0,2}('''|"""|'|")|([\p{L}_][\p{L}\p{N}_]*)|(\d[\w.]*|\\\n|[^\S\n]+)|([\n;])|(.)/uy;

/** Splits Python code into names, operators and statement ends. Strings and comments are left out. */
function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let depth = 0;
  let i = 0;
  while (i < code.length) {
    TOKEN.lastIndex = i;
    const [match = '', , quote, name, , end, op] = TOKEN.exec(code) ?? [];
    const start = i;
    i += match.length || 1;
    if (quote) {
      i = stringEnd(code, i, quote);
    } else if (name) {
      tokens.push({ type: 'name', value: name, start, end: i });
    } else if (end) {
      if (depth === 0 || end === ';') tokens.push({ type: 'end', value: end, start, end: i });
    } else if (op) {
      if ('([{'.includes(op)) depth++;
      if (')]}'.includes(op)) depth = Math.max(0, depth - 1);
      tokens.push({ type: 'op', value: op, start, end: i });
    }
  }
  return tokens;
}

function statements(tokens: Token[]) {
  const out: Token[][] = [[]];
  for (const token of tokens) {
    if (token.type === 'end') out.push([]);
    else out.at(-1)?.push(token);
  }
  return out.filter((s) => s.length > 0);
}

/** Reads a dotted name from `tokens[i]`. Returns its parts and the index after it. */
function dotted(tokens: Token[], i: number) {
  const parts: Token[] = [];
  while (tokens[i]?.type === 'name') {
    parts.push(tokens[i] as Token);
    if (tokens[i + 1]?.value !== '.' || tokens[i + 2]?.type !== 'name') return { parts, next: i + 1 };
    i += 2;
  }
  return { parts, next: i };
}

const text = (parts: Token[]) => parts.map((p) => p.value).join('.');

interface Imports {
  /** Local name to qualified name. */
  bindings: Map<string, string>;
  /** Names in import statements, with the qualified name that each one stands for. */
  names: { parts: Token[]; path: string }[];
  /** The `as` names in import statements, which are not links. */
  aliases: Token[];
}

function readImports(stmts: Token[][]): Imports {
  const bindings = new Map<string, string>();
  const names: Imports['names'] = [];
  const aliases: Token[] = [];
  const alias = (token: Token | undefined, path: string) => {
    if (!token) return;
    bindings.set(token.value, path);
    aliases.push(token);
  };
  for (const s of stmts) {
    if (s[0]?.value === 'import') {
      let i = 1;
      while (i < s.length) {
        const { parts, next } = dotted(s, i);
        if (parts.length === 0) break;
        names.push({ parts, path: text(parts) });
        i = next;
        if (s[i]?.value === 'as' && s[i + 1]?.type === 'name') {
          alias(s[i + 1], text(parts));
          i += 2;
        } else {
          bindings.set(parts[0]?.value as string, parts[0]?.value as string);
        }
        if (s[i]?.value !== ',') break;
        i++;
      }
    } else if (s[0]?.value === 'from' && s[1]?.type === 'name') {
      const { parts: from, next } = dotted(s, 1);
      if (s[next]?.value !== 'import') continue;
      const module = text(from);
      names.push({ parts: from, path: module });
      for (let i = next + 1; i < s.length; i++) {
        const token = s[i] as Token;
        if (token.type !== 'name') continue;
        const path = `${module}.${token.value}`;
        names.push({ parts: [token], path });
        if (s[i + 1]?.value === 'as' && s[i + 2]?.type === 'name') {
          alias(s[i + 2], path);
          i += 2;
        } else {
          bindings.set(token.value, path);
        }
      }
    }
  }
  return { bindings, names, aliases };
}

const BINDING_KEYWORDS = new Set(['def', 'class', 'as', 'global', 'nonlocal']);
const BARE_COLON_KEYWORDS = new Set(['else', 'try', 'finally', 'except']);

/** The token range of the type in `target: type = value`, or an empty range if the statement has none. */
function annotation(s: Token[]): [number, number] {
  const { parts, next } = dotted(s, 0);
  if (parts.length === 0 || BARE_COLON_KEYWORDS.has(parts[0]?.value ?? '')) return [0, 0];
  if (s[next]?.value !== ':' || s[next + 1]?.value === '=') return [0, 0];
  let i = next + 1;
  while (i < s.length && s[i]?.value !== '=') i = '([{'.includes(s[i]?.value ?? '') ? skipBrackets(s, i) : i + 1;
  return [next + 1, i];
}

/**
 * Names that the block binds outside its imports. Links for them would not be certain.
 * ponytail: misses tuple targets other than the last (`json, a = …`); a scope analysis would catch them.
 */
function reboundNames(stmts: Token[][]) {
  const rebound = new Set<string>();
  for (const s of stmts) {
    if (s[0]?.value === 'import' || s[0]?.value === 'from') continue;
    const defAt = s[0]?.value === 'def' ? 0 : s[0]?.value === 'async' && s[1]?.value === 'def' ? 1 : -1;
    const open = defAt >= 0 && s[defAt + 2]?.value === '(' ? defAt + 2 : -1;
    const close = open >= 0 ? skipBrackets(s, open) : -1;
    const [typeStart, typeEnd] = annotation(s);
    if (typeEnd && s[1]?.value === ':') rebound.add(s[0]?.value as string);
    let inFor = false;
    let depth = 0;
    let lambdaDepth = -1;
    s.forEach((token, i) => {
      if ('([{'.includes(token.value)) depth++;
      if (')]}'.includes(token.value)) depth--;
      if (token.value === 'lambda') lambdaDepth = depth;
      if (token.value === ':' && depth === lambdaDepth) lambdaDepth = -1;
      if (token.value === 'for') inFor = true;
      if (token.value === 'in') inFor = false;
      if (token.type !== 'name' || s[i - 1]?.value === '.' || (i >= typeStart && i < typeEnd)) return;
      const before = s[i - 1]?.value ?? '';
      // Inside brackets, `name=` is a keyword argument or a parameter default, not an assignment.
      const assigned = depth === 0 && s[i + 1]?.value === '=' && s[i + 2]?.value !== '=';
      const walrus = s[i + 1]?.value === ':' && s[i + 2]?.value === '=';
      const param =
        ((depth === 1 && i > open && i < close) || depth === lambdaDepth) && ['(', ',', '*', 'lambda'].includes(before);
      if (inFor || assigned || walrus || param || BINDING_KEYWORDS.has(before)) {
        rebound.add(token.value);
      }
    });
  }
  return rebound;
}

/**
 * Links Python names through the imports in each block: modules, attribute chains such as `json.loads`,
 * and methods called on a new instance, such as `Path(…).read_text`.
 */
export function python(options: PythonAdapterOptions = {}): ApiLinkAdapter {
  const { stdlib = true, inventories = [], summaries = true } = options;
  const index: PythonIndex = new Map();
  let warn = (_message: string) => {};
  let fetchPage: AdapterContext['fetch'] | undefined;
  const pages = new Map<string, Promise<Root | undefined>>();
  // starlight-pydocs pages win over the inventories.
  let base: string | undefined;
  const lookup = (path: string) => pydocsEntry(path, base) ?? index.get(path);
  const ref = (parts: Token[], path: string): SymbolRef | undefined => {
    const entry = lookup(path);
    const first = parts[0];
    const last = parts.at(-1);
    return entry && first && last ? { ...entry, start: first.start, end: last.end } : undefined;
  };

  return {
    name: 'python',
    languages: ['python', 'py', 'pycon'],
    async setup(context) {
      warn = context.warn;
      fetchPage = context.fetch;
      const all = [...(stdlib ? [STDLIB_INVENTORY] : []), ...inventories];
      for (const item of all) {
        const { url, base = new URL('.', url).href } = typeof item === 'string' ? { url: item } : item;
        await context.fetch(url, (data) => readInventory(data, base, index));
      }
    },
    // A summary is extra, so a page that does not load leaves the card without one, with no warning.
    async describe({ href }) {
      if (!summaries || !fetchPage || !URL.canParse(href)) return undefined;
      const url = new URL(href);
      const id = decodeURIComponent(url.hash.slice(1));
      if (!id || !url.protocol.startsWith('http')) return undefined;
      url.hash = '';
      let page = pages.get(url.href);
      if (!page) {
        page = fetchPage(url.href, undefined, { quiet: true }).then((body) => (body ? parsePage(body) : undefined));
        pages.set(url.href, page);
      }
      const tree = await page;
      return tree && sphinxSummary(tree, id);
    },
    findSymbols(code, _language, attributes = {}) {
      base = attributes.pydocsBase;
      if (base !== undefined && !pydocsRegistry()?.packages.some((pkg) => pkg.base === base)) {
        warn(`pydocsBase="${base}" is not the base of a starlight-pydocs package. Links use the first package.`);
      }
      const tokens = tokenize(code);
      const stmts = statements(tokens);
      const { bindings, names, aliases } = readImports(stmts);
      const rebound = reboundNames(stmts);
      const symbols: SymbolRef[] = [];
      const inImport = new Set([...names.flatMap((n) => n.parts), ...aliases]);
      for (const { parts, path } of names) {
        const symbol = ref(parts, path);
        if (symbol) symbols.push(symbol);
      }
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i] as Token;
        if (token.type !== 'name' || inImport.has(token) || tokens[i - 1]?.value === '.') continue;
        const binding = bindings.get(token.value);
        const before = tokens[i - 1]?.value ?? '';
        const keyword = ['(', ','].includes(before) && tokens[i + 1]?.value === '=' && tokens[i + 2]?.value !== '=';
        if (!binding || rebound.has(token.value) || keyword) continue;
        const { parts, next } = dotted(tokens, i);
        const path = (n: number) => [binding, ...parts.slice(1, n).map((p) => p.value)].join('.');
        let j = parts.length;
        let entry = lookup(path(j));
        while (!entry && --j > 0) entry = lookup(path(j));
        if (!entry) continue;
        symbols.push({ ...entry, start: token.start, end: (parts[j - 1] as Token).end });
        i = next - 1;
        // A call to a class gives an instance of it, so the attribute after the call is certain.
        if (j === parts.length && entry.kind === 'class' && tokens[next]?.value === '(') {
          const after = skipBrackets(tokens, next);
          const attribute = tokens[after + 1];
          if (tokens[after]?.value === '.' && attribute?.type === 'name') {
            const method = ref([attribute], `${entry.name}.${attribute.value}`);
            if (method) symbols.push(method);
          }
        }
      }
      return symbols;
    },
  };
}

export default python;
