import type { ApiLinkAdapter, Resolution, SymbolRef } from '../options.ts';
import { factories, factoryHref, operatorHref, operators, SOURCE } from './nextflow-reference.ts';
import { directives, type Entry, globals, namespaces, scopes, sections } from './nextflow-reference-data.ts';
import { skipBrackets, stringEnd } from './tokens.ts';

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

/** Splits Nextflow code into names, operators and strings. Comments are left out. */
function tokenize(code: string): Token[] {
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

/** The index after the arguments and closure of a call whose name ends before `tokens[i]`. */
function skipCall(tokens: Token[], i: number) {
  if (tokens[i]?.value === '(') i = skipBrackets(tokens, i);
  if (tokens[i]?.value === '{') i = skipBrackets(tokens, i);
  return i;
}

const isChannel = (token?: Token) => token?.value === 'channel' || token?.value === 'Channel';

const resolve = (map: Record<string, Entry>, name: string, kind?: string): Resolution | undefined => {
  if (!Object.hasOwn(map, name)) return undefined;
  const { href, signature, summary } = map[name] as Entry;
  return { href, kind, signature, summary, source: SOURCE };
};

// A string token's value is its content, so `'{'` must not count as `{`.
const op = (token: Token | undefined, chars: string) => token?.type === 'op' && chars.includes(token.value);
const opens = (token: Token) => op(token, '([{');
const closes = (token: Token) => op(token, ')]}');

/** Whether `tokens[i]` starts a statement: it follows `{` or `;`, or starts a line that does not continue a list. */
function startsStatement(code: string, tokens: Token[], i: number) {
  const prev = tokens[i - 1];
  if (!prev || op(prev, '{;')) return true;
  return !op(prev, ',') && code.slice(prev.end, tokens[i]?.start).includes('\n');
}

type Add = (start: Token, end: Token, name: string, resolution?: Resolution) => void;

const LABELS = new Set(['input', 'output', 'stage', 'topic', 'script', 'shell', 'exec', 'stub', 'when']);
const DECLARATIONS = new Set(['input', 'output', 'stage', 'topic']);
// A typed process declares `name: Type` or calls `stdout()`, and the inputs and outputs page is for legacy ones.
// Typed processes have no `val()` or `path()`.
const LEGACY = new Set(['val', 'path', 'file', 'env', 'stdin', 'stdout', 'eval', 'tuple', 'each']);

/**
 * Links the directives and the `input:` and `output:` labels of each `process` body. Returns the tokens of the
 * input and output declarations, also in a block with only part of a process. There, `tuple`, `env` and `file`
 * are qualifiers, not the global functions.
 */
function processLinks(code: string, tokens: Token[], add: Add) {
  const label = (i: number) =>
    tokens[i]?.type === 'name' &&
    tokens[i + 1]?.value === ':' &&
    LABELS.has(tokens[i]?.value ?? '') &&
    startsStatement(code, tokens, i);

  const declarations = new Set<Token>();
  let section: string | undefined;
  let sectionDepth = 0;
  let depth = 0;
  tokens.forEach((token, i) => {
    if (opens(token)) depth++;
    else if (closes(token) && --depth < sectionDepth) section = undefined;
    else if (label(i)) [section, sectionDepth] = [token.value, depth];
    if (section && DECLARATIONS.has(section)) declarations.add(token);
  });

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]?.value !== 'process' || tokens[i + 1]?.type !== 'name' || tokens[i + 2]?.value !== '{') continue;
    if (!startsStatement(code, tokens, i)) continue;
    const end = skipBrackets(tokens, i + 2);
    let labelled = false;
    for (let j = i + 3; j < end; j++) {
      const token = tokens[j] as Token;
      if (opens(token)) j = skipBrackets(tokens, j) - 1;
      if (token.type !== 'name' || !startsStatement(code, tokens, j)) continue;
      if (label(j)) {
        labelled = true;
        const first = tokens[j + 2]?.value ?? '';
        const after = tokens[j + 3];
        const legacy = LEGACY.has(first) && (op(after, '(') ? first === 'val' || first === 'path' : !op(after, ':='));
        if (legacy) add(token, token, token.value, resolve(sections, token.value, 'process section'));
      } else if (!labelled && !['=', '.', ':'].includes(tokens[j + 1]?.value ?? '')) {
        add(token, token, token.value, resolve(directives, token.value, 'process directive'));
      }
    }
    i = end - 1;
  }
  return declarations;
}

/** Links config scopes at the start of a setting, and directives in the `process` scope. */
function configLinks(code: string, tokens: Token[], add: Add) {
  type Scope = 'top' | 'profiles' | 'process' | 'other';
  // What each open bracket holds. A profile body holds settings, as the top level does.
  const stack: Scope[] = [];
  let block: Scope | undefined;
  tokens.forEach((token, i) => {
    if (opens(token)) {
      stack.push((token.value === '{' && block) || 'other');
      block = undefined;
      return;
    }
    if (closes(token)) {
      stack.pop();
      return;
    }
    const within = stack.at(-1) ?? 'top';
    if (within === 'other' || !startsStatement(code, tokens, i)) return;
    block = undefined;
    const { value } = token;
    const next = tokens[i + 1]?.value;
    const member = tokens[i + 2];
    if (within === 'profiles') block = 'top';
    else if (token.type !== 'name') return;
    else if (within === 'process') {
      if (value === 'withName' || value === 'withLabel') block = 'process';
      else add(token, token, value, resolve(directives, value, 'process directive'));
    } else if (Object.hasOwn(scopes, value)) {
      const settings = (scopes[value] as Entry).settings ?? [];
      const process = value === 'process';
      const setting =
        next === '.' &&
        member?.type === 'name' &&
        (process ? Object.hasOwn(directives, member.value) : settings.length === 0 || settings.includes(member.value));
      if (next === '{' || setting) add(token, token, value, resolve(scopes, value, 'config scope'));
      if (next === '{' && (process || value === 'profiles')) block = value as Scope;
      if (process && setting && member) {
        add(member, member, member.value, resolve(directives, member.value, 'process directive'));
      }
    }
  });
}

/** Names that the block binds: assigned, declared with `def`, loop variables, and closure and function parameters. */
function boundNames(tokens: Token[]) {
  const bound = new Set<string>();
  const names = (from: number, to: number) => {
    for (const token of tokens.slice(from, to)) if (token.type === 'name') bound.add(token.value);
  };
  // Not the names in default values, such as `params` in `def f(dir = params.outdir)`.
  const parameters = (open: number) => {
    let value = false;
    for (let j = open + 1, end = skipBrackets(tokens, open) - 1; j < end; j++) {
      const token = tokens[j] as Token;
      if (opens(token)) j = skipBrackets(tokens, j) - 1;
      else if (op(token, '=,')) value = token.value === '=';
      else if (!value && token.type === 'name') bound.add(token.value);
    }
  };
  tokens.forEach((token, i) => {
    const prev = tokens[i - 1]?.value;
    const next = tokens[i + 1]?.value;
    if (token.value === '-' && next === '>' && tokens[i + 1]?.start === token.end) {
      let j = i;
      while (tokens[j - 1]?.type === 'name' || [',', ':'].includes(tokens[j - 1]?.value ?? '')) j--;
      names(j, i);
    }
    if (token.type !== 'name') return;
    if (prev === 'def' || (prev === '(' && tokens[i - 2]?.value === 'for')) bound.add(token.value);
    if (next === '=' && !['=', '~'].includes(tokens[i + 2]?.value ?? '') && prev !== '.') bound.add(token.value);
    if (token.value === 'def') {
      const open = next === '(' ? i + 1 : tokens[i + 2]?.value === '(' ? i + 2 : -1;
      if (open > 0) parameters(open);
    }
  });
  return bound;
}

/** Whether the global name at `tokens[i]` is used: not a map key or a `params` block, and a function is called. */
function usesGlobal(code: string, tokens: Token[], i: number) {
  const token = tokens[i] as Token;
  const next = tokens[i + 1];
  if (op(next, ':{')) return false;
  const { signature = '' } = globals[token.value] as Entry;
  if (!signature.includes('(')) return true;
  // Only a function that returns nothing works as a statement without brackets, such as `println 'Hello'`.
  const statement = !signature.includes('->') && startsStatement(code, tokens, i);
  return op(next, '(') || (statement && /^[ \t]+["'\w$]/.test(code.slice(token.end)));
}

/**
 * Links Nextflow channel factories, operators called on a channel, processes and workflows from `include`
 * statements, process directives and the standard library. In config files, it links config scopes.
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

  let warn = (_message: string) => {};

  return {
    name: 'nextflow',
    languages: ['nextflow', 'nf'],
    async setup(context) {
      warn = context.warn;
    },
    findSymbols(code, _language, attributes = {}) {
      const tokens = tokenize(code);
      const symbols: SymbolRef[] = [];
      const add: Add = (start, end, name, resolution) => {
        if (resolution)
          symbols.push({ ...resolution, name: resolution.name ?? name, start: start.start, end: end.end });
      };
      const at = (i: number) => tokens[i] as Token;

      const file = attributes.nextflow;
      if (file !== undefined && file !== 'config') {
        warn(`nextflow="${file}" is not a file type that the adapter knows, so the adapter ignores it.`);
      }
      // nf-test has its own `workflow` and `file()`.
      if (attributes.title?.endsWith('.nf.test')) return symbols;
      if (file === 'config' || attributes.title?.endsWith('.config')) {
        configLinks(code, tokens, add);
        return symbols;
      }
      const declarations = processLinks(code, tokens, add);
      const bound = boundNames(tokens);

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

      // The standard library, also in the arguments that the loop above skips.
      tokens.forEach((token, i) => {
        if (token.type !== 'name' || tokens[i - 1]?.value === '.' || inInclude.has(token)) return;
        if (bound.has(token.value) || declarations.has(token)) return;
        const member = tokens[i + 2];
        if (Object.hasOwn(namespaces, token.value) && tokens[i + 1]?.value === '.' && member) {
          const members = namespaces[token.value] as Record<string, Entry>;
          const oneLine = !code.slice(token.start, member.end).includes('\n');
          add(oneLine ? token : member, member, `${token.value}.${member.value}`, resolve(members, member.value));
        } else if (Object.hasOwn(globals, token.value) && usesGlobal(code, tokens, i)) {
          add(token, token, token.value, resolve(globals, token.value));
        }
      });
      return symbols;
    },
  };
}

export default nextflow;
