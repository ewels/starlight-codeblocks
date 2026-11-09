import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AdapterContext, ApiLinkAdapter, Resolution, SymbolRef } from '../options.ts';
import { dotted, endsStatement, interpolations, op, type Syntax, skipCall, type Token, tokenize } from './tokens.ts';

/** One name in an API index. */
export interface ApiSymbol {
  /** The name. A member has its namespace or type before it, with a dot: `log.info`, `Path.baseName`. */
  name: string;
  /** What the name is, such as `function` or `config setting`. The card shows it when there is no signature. */
  kind: string;
  /** Where the name applies, in terms that the language's adapter knows. A name without one applies anywhere. */
  context?: string;
  /** The docs link, relative to the index's `base`. */
  href: string;
  signature?: string;
  /** One sentence, in Markdown. */
  summary?: string;
  /** The type of the value: the return type of a function, or the type of a property. */
  type?: string;
  /** For a type: the types whose members it also has. */
  extends?: string[];
}

/** The names of a language or a library, with their docs links, as an API index file holds them. */
export interface ApiIndex {
  /** The version of the format. */
  apiIndex: 1;
  /** The name of the docs, shown on the card. */
  source?: string;
  version?: string;
  /** The URL that each `href` is relative to. */
  base?: string;
  symbols: ApiSymbol[];
}

/** An API index: a URL, a file path from the project root, or the index itself. */
export type ApiIndexSource = string | URL | ApiIndex;

function parse(data: Uint8Array | string): ApiIndex {
  const index = JSON.parse(typeof data === 'string' ? data : new TextDecoder().decode(data));
  if (index?.apiIndex !== 1 || !Array.isArray(index.symbols)) throw new Error('not an API index, version 1');
  return index;
}

/**
 * Loads an API index. The build fetches a URL once and keeps it on disk, as it does Sphinx inventories.
 * Returns `undefined`, with a build warning, if the index does not load.
 */
export async function loadApiIndex(source: ApiIndexSource, context: AdapterContext): Promise<ApiIndex | undefined> {
  if (typeof source === 'object' && !(source instanceof URL)) return parse(JSON.stringify(source));
  const text = String(source);
  if (/^https?:\/\//.test(text)) {
    let index: ApiIndex | undefined;
    await context.fetch(text, (data) => {
      index = parse(data);
    });
    return index;
  }
  const path = text.startsWith('file:') ? fileURLToPath(text) : resolve(context.root, text);
  try {
    return parse(await readFile(path, 'utf8'));
  } catch (error) {
    context.warn(
      `could not read ${path} (${error instanceof Error ? error.message : error}). Its names stay plain text.`,
    );
    return undefined;
  }
}

/** The type name without its type arguments and `?`, such as `Channel` for `Channel<E>`. */
export const baseType = (type: string) =>
  type
    .replace(/<[\s\S]*$/, '')
    .replace(/\?$/, '')
    .trim();

/** The symbols of an API index by name, with the links and cards for them. */
export class SymbolIndex {
  readonly symbols: ApiSymbol[];
  private readonly byName = new Map<string, ApiSymbol[]>();
  private readonly base?: string;
  private readonly source: string;

  constructor(index: ApiIndex, source: string) {
    this.symbols = index.symbols;
    this.base = index.base;
    this.source = index.source ?? source;
    for (const symbol of index.symbols) {
      const list = this.byName.get(symbol.name);
      if (list) list.push(symbol);
      else this.byName.set(symbol.name, [symbol]);
    }
  }

  /** The first symbol of `name` that passes `test`. By default, one that applies anywhere. */
  find(name: string, test: (symbol: ApiSymbol) => boolean = (symbol) => !symbol.context) {
    return this.byName.get(name)?.find(test);
  }

  /** The member `name` of `type`, also from the types that it extends. */
  member(type: string, name: string, seen = new Set<string>()): ApiSymbol | undefined {
    const owner = baseType(type);
    if (seen.has(owner)) return undefined;
    seen.add(owner);
    const found = this.find(`${owner}.${name}`);
    if (found) return found;
    for (const parent of this.find(owner, (symbol) => symbol.kind === 'type')?.extends ?? []) {
      const inherited = this.member(parent, name, seen);
      if (inherited) return inherited;
    }
    return undefined;
  }

  /** The link and card of a symbol. */
  link(symbol: ApiSymbol | undefined): Resolution | undefined {
    if (!symbol) return undefined;
    const { href, kind, signature, summary } = symbol;
    return {
      href: this.base && !URL.canParse(href) ? new URL(href, this.base).href : href,
      kind,
      signature,
      summary,
      source: this.source,
    };
  }
}

export interface ApiIndexAdapterOptions {
  /** The code block languages that the adapter links, such as `['mylang']`. */
  languages: string[];
  /** The API index: a URL, a file path from the project root, or the index itself. */
  index: ApiIndexSource;
  /** The adapter name in build warnings. Default: the first language. */
  name?: string;
  /** How the language writes comments and strings. */
  syntax?: Partial<Syntax>;
}

/** Comments and strings of most languages: `//`, `#`, `/* … *\/`, and single, double, triple and back quotes. */
export const DEFAULT_SYNTAX: Syntax = { comments: ['//', '#'], quotes: ['"""', "'''", '"', "'", '`'] };

/**
 * Links the names in an API index: global names, dotted names such as `log.info`, and the members of a value
 * whose type the block shows, through the `type` of each name. Names with a `context` need an adapter of their own.
 */
export function apiIndex(options: ApiIndexAdapterOptions): ApiLinkAdapter {
  const syntax: Syntax = { ...DEFAULT_SYNTAX, ...options.syntax };
  const name = options.name ?? options.languages[0] ?? 'api-index';
  let index = new SymbolIndex({ apiIndex: 1, symbols: [] }, name);
  return {
    name,
    languages: options.languages,
    async setup(context) {
      const loaded = await loadApiIndex(options.index, context);
      if (loaded) index = new SymbolIndex(loaded, name);
    },
    findSymbols(code) {
      const [tokens] = tokenize(code, syntax);
      return linkNames(code, tokens, index);
    },
  };
}

const isType = (symbol: ApiSymbol) => symbol.kind === 'type';

/** The links of the names in `tokens` and in their interpolated strings. */
export function linkNames(code: string, tokens: Token[], index: SymbolIndex): SymbolRef[] {
  const symbols: SymbolRef[] = [];
  const add = (token: Token, symbol: ApiSymbol) => {
    const resolution = index.link(symbol);
    if (resolution) symbols.push({ ...resolution, name: symbol.name, start: token.start, end: token.end });
  };

  // A variable keeps a type only if every declaration and assignment in the block gives the same one.
  const known = new Map<string, string | null>();
  const note = (variable: string, type?: string) =>
    known.set(variable, known.has(variable) && known.get(variable) !== type ? null : (type ?? null));

  /** Follows the members after a value of `type` from `segment[i]`. Returns the type at the end and its index. */
  const walk = (segment: Token[], i: number, type: string | undefined, link: boolean) => {
    while (type && op(segment[i], '.') && segment[i + 1]?.type === 'name') {
      const member = index.member(type, (segment[i + 1] as Token).value);
      if (!member) return [undefined, i] as const;
      if (link) add(segment[i + 1] as Token, member);
      type = member.type;
      i = skipCall(segment, i + 2);
    }
    return [type, i] as const;
  };

  /** The value that starts at `segment[i]`: its type and the index after it. Links its names if `link`. */
  const value = (segment: Token[], i: number, link: boolean) => {
    const token = segment[i];
    if (token?.type === 'string') return walk(segment, i + 1, index.find('String', isType) && 'String', link);
    if (token?.type !== 'name' || op(segment[i + 1], ':')) return [undefined, i + 1] as const;
    if (known.has(token.value)) return walk(segment, i + 1, known.get(token.value) ?? undefined, link);
    // Each part of a dotted name that is in the index links to its own symbol: `log` and `log.info`. The value
    // is the longest one, and the dotted name's parts are at every other token.
    const names = dotted(segment, i).map((part) => part.value);
    let found: ApiSymbol | undefined;
    let end = i + 1;
    for (let k = 1; k <= names.length; k++) {
      const symbol = index.find(names.slice(0, k).join('.'));
      if (!symbol) continue;
      if (link) add(segment[i + 2 * (k - 1)] as Token, symbol);
      [found, end] = [symbol, i + 2 * k - 1];
    }
    if (!found) return [undefined, i + 1] as const;
    return walk(segment, skipCall(segment, end), found.type, link);
  };

  tokens.forEach((token, i) => {
    if (token.type !== 'name' || op(tokens[i - 1], '.')) return;
    const next = tokens[i + 1];
    const type = tokens[i + 2];
    if (op(next, ':') && type?.type === 'name' && index.find(type.value, isType)) note(token.value, type.value);
    else if (next?.value === '=' && !op(tokens[i + 2], '=~')) {
      const [assigned, end] = value(tokens, i + 2, false);
      note(token.value, endsStatement(code, tokens, end) ? assigned : undefined);
    }
  });

  for (const segment of [tokens, ...interpolations(tokens)]) {
    segment.forEach((token, i) => {
      if (token.type !== 'op' && !op(segment[i - 1], '.')) value(segment, i, true);
    });
  }
  return symbols;
}

export default apiIndex;
