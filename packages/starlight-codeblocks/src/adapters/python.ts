import type { ApiLinkAdapter, SymbolRef } from '../options.ts';
import { type PythonIndex, readInventory, readPydocs } from './python-index.ts';

export interface PythonInventory {
  /** The URL of a Sphinx `objects.inv`. */
  url: string;
  /** The URL that relative links in the inventory start from. The default is the folder of `url`. */
  base?: string;
}

export interface PydocsPackage {
  /** The package name, as given to starlight-pydocs. */
  package: string;
  /** The URL base of its pages, as given to starlight-pydocs. The default is `api/<package>`. */
  base?: string;
  /** A Griffe dump to read, relative to the project root. The default is the one starlight-pydocs made. */
  dump?: string;
}

export interface PythonAdapterOptions {
  /** Link names from the Python standard library. The default is `true`. */
  stdlib?: boolean;
  /** More Sphinx inventories, such as `https://numpy.org/doc/stable/objects.inv`. */
  inventories?: (string | PythonInventory)[];
  /** Packages that the site documents with starlight-pydocs. Their pages win over the inventories. */
  pydocs?: PydocsPackage[];
}

export const STDLIB_INVENTORY = { url: 'https://docs.python.org/3/objects.inv', base: 'https://docs.python.org/3/' };

interface Token {
  type: 'name' | 'op' | 'end';
  value: string;
  start: number;
  end: number;
}

const TOKEN =
  /(#[^\n]*)|[rRbBuUfFtT]{0,2}('''|"""|'|")|([\p{L}_][\p{L}\p{N}_]*)|(\d[\w.]*|\\\n|[^\S\n]+)|([\n;])|(.)/uy;

/** The index after the string whose opening `quote` ends before `i`. An unclosed one-line string ends at the line. */
function stringEnd(code: string, i: number, quote: string) {
  while (i < code.length && !code.startsWith(quote, i)) {
    if (code[i] === '\\') i++;
    else if (quote.length === 1 && code[i] === '\n') return i;
    i++;
  }
  return Math.min(i + quote.length, code.length);
}

/** Splits Python code into names, operators and statement ends. Strings and comments are left out. */
export function tokenize(code: string): Token[] {
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

const BINDING_KEYWORDS = new Set(['def', 'class', 'as', 'global', 'nonlocal', 'lambda']);

/**
 * Names that the block binds outside its imports. Links for them would not be certain.
 * ponytail: misses tuple targets other than the last (`json, a = …`); a scope analysis would catch them.
 */
function reboundNames(stmts: Token[][]) {
  const rebound = new Set<string>();
  for (const s of stmts) {
    if (s[0]?.value === 'import' || s[0]?.value === 'from') continue;
    let inFor = false;
    s.forEach((token, i) => {
      if (token.value === 'for') inFor = true;
      if (token.value === 'in') inFor = false;
      if (token.type !== 'name' || s[i - 1]?.value === '.') return;
      const before = s[i - 1]?.value ?? '';
      const assigned = s[i + 1]?.value === '=' && s[i + 2]?.value !== '=';
      const walrus = s[i + 1]?.value === ':' && s[i + 2]?.value === '=';
      const param = s[0]?.value === 'def' && ['(', ',', '*'].includes(before);
      if (inFor || assigned || walrus || param || BINDING_KEYWORDS.has(before)) {
        rebound.add(token.value);
      }
    });
  }
  return rebound;
}

/** Skips the brackets that start at `tokens[i]`, and returns the index after them. */
function skipBrackets(tokens: Token[], i: number) {
  let depth = 0;
  for (; i < tokens.length; i++) {
    const value = tokens[i]?.value;
    if (value === '(' || value === '[' || value === '{') depth++;
    if (value === ')' || value === ']' || value === '}') depth--;
    if (depth === 0) return i + 1;
  }
  return i;
}

/**
 * Links Python names through the imports in each block: modules, attribute chains such as `json.loads`,
 * and methods called on a new instance, such as `Path(…).read_text`.
 */
export function python(options: PythonAdapterOptions = {}): ApiLinkAdapter {
  const { stdlib = true, inventories = [], pydocs = [] } = options;
  const index: PythonIndex = new Map();
  const ref = (parts: Token[], path: string): SymbolRef | undefined => {
    const entry = index.get(path);
    const first = parts[0];
    const last = parts.at(-1);
    return entry && first && last ? { start: first.start, end: last.end, name: path, context: entry } : undefined;
  };

  return {
    name: 'python',
    languages: ['python', 'py'],
    async setup(context) {
      for (const source of pydocs) {
        try {
          readPydocs(source, context, index);
        } catch (error) {
          context.warn(error instanceof Error ? error.message : String(error));
        }
      }
      const all = [...(stdlib ? [STDLIB_INVENTORY] : []), ...inventories];
      for (const item of all) {
        const { url, base = new URL('.', url).href } = typeof item === 'string' ? { url: item } : item;
        const data = await context.fetch(url);
        if (!data) continue;
        try {
          readInventory(data, base, index);
        } catch (error) {
          context.warn(`${url} is ${error instanceof Error ? error.message : error}. Names from it stay plain text.`);
        }
      }
    },
    findSymbols(code) {
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
        if (!binding || rebound.has(token.value)) continue;
        const { parts, next } = dotted(tokens, i);
        let j = parts.length;
        const path = (n: number) => [binding, ...parts.slice(1, n).map((p) => p.value)].join('.');
        while (j > 0 && !index.has(path(j))) j--;
        if (j === 0) continue;
        const found = ref(parts.slice(0, j), path(j));
        if (found) symbols.push(found);
        i = next - 1;
        // A call to a class gives an instance of it, so the attribute after the call is certain.
        const entry = index.get(path(j));
        if (j === parts.length && entry?.kind === 'class' && tokens[next]?.value === '(') {
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
    resolve: (symbol) => (symbol.context as ReturnType<PythonIndex['get']>) ?? null,
  };
}

export default python;
