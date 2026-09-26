import type { ApiLinkAdapter, Resolution, SymbolRef } from '../options.ts';
import { factories, factoryHref, operatorHref, operators, SOURCE } from './nextflow-reference.ts';

export interface ModuleInput {
  /** The process or workflow name, as in the module (`FASTQC` for `include { FASTQC as QC } …`). */
  name: string;
  /** The path after `from`, as written. */
  path: string;
}

export interface NextflowAdapterOptions {
  /**
   * The reference page of an included process or workflow: a URL, an object with the URL and more card text,
   * or `undefined` to leave the name as plain text.
   */
  modules?: (module: ModuleInput) => string | (Omit<Resolution, 'source'> & { source?: string }) | undefined;
}

interface Token {
  type: 'name' | 'op' | 'string';
  value: string;
  start: number;
  end: number;
}

// Slashy strings are left out: `/` is division far more often in examples.
const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|('''|"""|'|")|([A-Za-z_$][\w$]*)|(\d[\w.]*|\s+)|(.)/y;

function stringEnd(code: string, i: number, quote: string) {
  while (i < code.length && !code.startsWith(quote, i)) {
    if (code[i] === '\\') i++;
    else if (quote.length === 1 && code[i] === '\n') return i;
    i++;
  }
  return Math.min(i + quote.length, code.length);
}

/** Splits Nextflow code into names, operators and strings. Comments are left out. */
export function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < code.length) {
    TOKEN.lastIndex = i;
    const [match = '', , quote, name, , op] = TOKEN.exec(code) ?? [];
    const start = i;
    i += match.length || 1;
    if (quote) {
      i = stringEnd(code, i, quote);
      tokens.push({ type: 'string', value: code.slice(start + quote.length, i - quote.length), start, end: i });
    } else if (name) {
      tokens.push({ type: 'name', value: name, start, end: i });
    } else if (op) {
      tokens.push({ type: 'op', value: op, start, end: i });
    }
  }
  return tokens;
}

/** The index after the brackets that open at `tokens[i]`. */
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

/** The index after the arguments and closure of a call whose name ends before `tokens[i]`. */
function skipCall(tokens: Token[], i: number) {
  if (tokens[i]?.value === '(') i = skipBrackets(tokens, i);
  if (tokens[i]?.value === '{') i = skipBrackets(tokens, i);
  return i;
}

const isChannel = (token?: Token) => token?.value === 'channel' || token?.value === 'Channel';

/**
 * Links Nextflow channel factories, operators called on a channel, and processes and workflows
 * from `include` statements.
 */
export function nextflow(options: NextflowAdapterOptions = {}): ApiLinkAdapter {
  const factory = (name: string): Resolution => ({
    href: factoryHref(name),
    kind: 'channel factory',
    ...(factories[name] as { signature: string; summary: string }),
    source: SOURCE,
  });
  const operator = (name: string): Resolution => {
    const [summary, returns] = operators[name] as [string, string];
    return { href: operatorHref(name), kind: 'operator', summary: `${summary} Returns ${returns}.`, source: SOURCE };
  };
  const module = (input: ModuleInput): Resolution | undefined => {
    const result = options.modules?.(input);
    if (!result) return undefined;
    return typeof result === 'string'
      ? { href: result, name: input.name, source: 'Module reference' }
      : { name: input.name, source: 'Module reference', ...result };
  };

  return {
    name: 'nextflow',
    languages: ['nextflow', 'nf'],
    async setup() {},
    findSymbols(code) {
      const tokens = tokenize(code);
      const symbols: SymbolRef[] = [];
      const add = (start: Token, end: Token, name: string, resolution?: Resolution) => {
        if (resolution) symbols.push({ start: start.start, end: end.end, name, context: resolution });
      };
      const at = (i: number) => tokens[i] as Token;

      // Variables that hold a channel: every assignment to them is a channel expression, or they come from `set`/`tap`.
      const assigned = new Map<string, boolean>();
      tokens.forEach((token, i) => {
        if (token.type !== 'name') return;
        const next = tokens[i + 1]?.value;
        if (tokens[i - 1]?.value !== '.' && next === '=' && tokens[i + 2]?.value !== '=') {
          const channel = isChannel(tokens[i + 2]) && tokens[i + 3]?.value === '.';
          assigned.set(token.value, (assigned.get(token.value) ?? true) && channel);
        }
        const target = tokens[i + 2];
        if (['set', 'tap'].includes(token.value) && tokens[i - 1]?.value === '.' && next === '{') {
          if (target?.type === 'name' && tokens[i + 3]?.value === '}') {
            assigned.set(target.value, assigned.get(target.value) ?? true);
          }
        }
      });
      const channels = new Set([...assigned].filter(([, channel]) => channel).map(([name]) => name));

      // Processes and workflows from `include { A; B as C } from '…'`.
      const included = new Map<string, Resolution>();
      const inInclude = new Set<Token>();
      for (let i = 0; i < tokens.length; i++) {
        if (at(i).value !== 'include' || tokens[i + 1]?.value !== '{') continue;
        const close = skipBrackets(tokens, i + 1);
        const path = tokens[close]?.value === 'from' ? tokens[close + 1] : undefined;
        if (path?.type !== 'string') continue;
        for (const token of tokens.slice(i, close)) inInclude.add(token);
        for (let j = i + 2; j < close - 1; j++) {
          const name = at(j);
          if (name.type !== 'name') continue;
          const resolution = module({ name: name.value, path: path.value });
          add(name, name, name.value, resolution);
          const alias = tokens[j + 1]?.value === 'as' ? tokens[j + 2] : undefined;
          if (resolution) included.set(alias?.value ?? name.value, resolution);
          if (alias) j += 2;
        }
        i = close + 1;
      }

      /** Links the operators in the chain after `tokens[i]`. */
      const chain = (i: number) => {
        while (
          tokens[i]?.value === '.' &&
          tokens[i + 1]?.type === 'name' &&
          Object.hasOwn(operators, at(i + 1).value)
        ) {
          add(at(i + 1), at(i + 1), at(i + 1).value, operator(at(i + 1).value));
          i = skipCall(tokens, i + 2);
        }
        return i;
      };

      for (let i = 0; i < tokens.length; i++) {
        const token = at(i);
        if (token.type !== 'name' || inInclude.has(token) || tokens[i - 1]?.value === '.') continue;
        const name = tokens[i + 2];
        if (isChannel(token) && tokens[i + 1]?.value === '.' && name && Object.hasOwn(factories, name.value)) {
          // One link for `channel.of`, unless a line break splits it.
          const oneLine = !code.slice(token.start, name.end).includes('\n');
          add(oneLine ? token : name, name, `channel.${name.value}`, factory(name.value));
          i = chain(skipCall(tokens, i + 3)) - 1;
        } else if (channels.has(token.value) && tokens[i + 1]?.value !== '=') {
          i = chain(i + 1) - 1;
        } else if (included.has(token.value)) {
          add(token, token, token.value, included.get(token.value));
        }
      }
      return symbols;
    },
    resolve: (symbol) => (symbol.context as Resolution | undefined) ?? null,
  };
}

export default nextflow;
