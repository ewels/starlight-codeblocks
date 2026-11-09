import type { ApiLinkAdapter, Resolution, SymbolRef } from '../options.ts';
import { factories, factoryHref, operatorHref, operators, SOURCE } from './nextflow-reference.ts';
import {
  directives,
  type Entry,
  flags,
  globals,
  keywords,
  labels,
  namespaces,
  qualifiers,
  scopes,
  sections,
  settings,
  task,
  typedFunctions,
  types,
} from './nextflow-reference-data.ts';
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
  /** The code in each `$name` and `${…}` of a double-quoted string. */
  parts?: Token[][];
}

// Slashy strings are left out: `/` is division far more often in examples.
const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|('''|"""|'|")|([A-Za-z_$][\w$]*)|(\d[\w.]*|\s+)|(.)/y;
const INTERPOLATED = /[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/y;

/**
 * Splits Nextflow code into names, operators and strings, from `i`. Comments are left out. With `inner`, it stops
 * after the `}` that closes a `${`. Returns the tokens and the index where it stopped.
 */
function tokenize(code: string, i = 0, inner = false): [Token[], number] {
  const tokens: Token[] = [];
  let depth = 0;
  while (i < code.length) {
    TOKEN.lastIndex = i;
    const [match = '', , quote, name, , op] = TOKEN.exec(code) ?? [];
    const start = i;
    i += match.length || 1;
    if (quote) {
      const parts: Token[][] = [];
      i = quote.startsWith('"') ? interpolatedEnd(code, i, quote, parts) : stringEnd(code, i, quote);
      tokens.push({ type: 'string', value: code.slice(start + quote.length, i - quote.length), start, end: i, parts });
    } else if (name) {
      tokens.push({ type: 'name', value: name, start, end: i });
    } else if (op) {
      if (inner && op === '}' && depth-- === 0) return [tokens, i];
      if (op === '{') depth++;
      tokens.push({ type: 'op', value: op, start, end: i });
    }
  }
  return [tokens, i];
}

/**
 * The index after the double-quoted string whose `quote` ends before `i`. Adds the tokens of each `$name` and
 * `${…}` to `parts`. A `${…}` can span lines, also in a one-line string.
 */
function interpolatedEnd(code: string, i: number, quote: string, parts: Token[][]) {
  while (i < code.length && !code.startsWith(quote, i)) {
    if (code[i] === '\\') {
      i += 2;
    } else if (code.startsWith('${', i)) {
      const [tokens, end] = tokenize(code, i + 2, true);
      parts.push(tokens);
      i = end;
    } else if (code[i] === '$') {
      INTERPOLATED.lastIndex = i + 1;
      const end = INTERPOLATED.test(code) ? INTERPOLATED.lastIndex : i + 1;
      if (end > i + 1) parts.push(tokenize(code.slice(0, end), i + 1)[0]);
      i = end;
    } else if (quote.length === 1 && code[i] === '\n') {
      return i;
    } else {
      i++;
    }
  }
  return Math.min(i + quote.length, code.length);
}

/** Each list of tokens in the strings of `tokens`, also in strings inside them. */
const interpolations = (tokens: Token[]): Token[][] =>
  tokens.flatMap((token) => (token.parts ?? []).flatMap((part) => [part, ...interpolations(part)]));

/** The index after the arguments and closure of a call whose name ends before `tokens[i]`. */
function skipCall(tokens: Token[], i: number) {
  if (tokens[i]?.value === '(') i = skipBrackets(tokens, i);
  if (tokens[i]?.value === '{') i = skipBrackets(tokens, i);
  return i;
}

/** The names of the dotted name that starts at `tokens[i]`, such as `docker` and `enabled`. */
function dotted(tokens: Token[], i: number) {
  const names = [tokens[i] as Token];
  for (let j = i; op(tokens[j + 1], '.') && tokens[j + 2]?.type === 'name'; j += 2) names.push(tokens[j + 2] as Token);
  return names;
}

const isChannel = (token?: Token) => token?.value === 'channel' || token?.value === 'Channel';

const link = ({ href, signature, summary }: Entry, kind?: string): Resolution => ({
  href,
  kind,
  signature,
  summary,
  source: SOURCE,
});

const resolve = (map: Record<string, Entry>, name: string, kind?: string) =>
  Object.hasOwn(map, name) ? link(map[name] as Entry, kind) : undefined;

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

/** Whether the expression that ends before `tokens[i]` ends its statement. */
function endsStatement(code: string, tokens: Token[], i: number) {
  const next = tokens[i];
  if (!next || op(next, ';})')) return true;
  return code.slice(tokens[i - 1]?.end, next.start).includes('\n') && !op(next, '.?:+-*/|&=<>');
}

type Add = (start: Token, end: Token, name: string, resolution?: Resolution) => void;
/** Records a type for a variable. A variable keeps a type only if every place that sets it gives the same type. */
type Note = (name: string, type?: string) => void;

const LABELS = new Set(['input', 'output', 'stage', 'topic', 'script', 'shell', 'exec', 'stub', 'when']);
const DECLARATIONS = new Set(['input', 'output', 'stage', 'topic']);
// A typed process declares `name: Type` or calls `stdout()`, and the inputs and outputs page is for legacy ones.
// Typed processes have no `val()` or `path()`.
const LEGACY = new Set(['val', 'path', 'file', 'env', 'stdin', 'stdout', 'eval', 'tuple', 'each']);
// `Iterable` has the members that these types share.
const PARENTS: Record<string, string> = { Bag: 'Iterable', List: 'Iterable', Set: 'Iterable' };
// Types that the adapter follows. `Value` is a dataflow value, which takes the same operators as a channel.
const TYPES = new Set([...Object.keys(types), 'Channel', 'Value']);
// The start of each setting name, so that `aws.batch` is a group of settings and `env` takes any name.
const PREFIXES = new Set(
  Object.keys(settings).flatMap((name) => name.split('.').map((_, n, parts) => parts.slice(0, n + 1).join('.'))),
);

const isLabel = (code: string, tokens: Token[], i: number) =>
  tokens[i]?.type === 'name' &&
  tokens[i + 1]?.value === ':' &&
  LABELS.has(tokens[i]?.value ?? '') &&
  startsStatement(code, tokens, i);

/** Whether the declarations that start at `tokens[i]` are legacy: the first one starts with a qualifier. */
function legacyAt(tokens: Token[], i: number) {
  const first = tokens[i]?.value ?? '';
  const after = tokens[i + 1];
  return LEGACY.has(first) && (op(after, '(') ? first === 'val' || first === 'path' : !op(after, ':='));
}

/**
 * Links the qualifiers and output options of legacy input and output declarations, and the functions of typed
 * declarations, also in a block with only part of a process. Notes the type of each legacy input variable.
 * Returns the tokens of legacy declarations, where `tuple`, `env` and `file` are qualifiers, not the global
 * functions, and the typed functions that it linked.
 */
function declarationLinks(code: string, tokens: Token[], add: Add, note: Note) {
  const handled = new Set<Token>();
  let section: string | undefined;
  let legacy = false;
  let first: Token | undefined;
  let sectionDepth = 0;
  let depth = 0;
  tokens.forEach((token, i) => {
    if (opens(token)) depth++;
    else if (closes(token) && --depth < sectionDepth) section = undefined;
    else if (isLabel(code, tokens, i)) {
      [section, sectionDepth] = [token.value, depth];
      legacy = (section === 'input' || section === 'output') && legacyAt(tokens, i + 2);
      return;
    }
    if (!section || !DECLARATIONS.has(section)) return;
    const next = tokens[i + 1];
    if (!legacy) {
      const functions = section === 'stage' ? typedFunctions.stage : typedFunctions.outputs;
      const call = section === 'stage' ? startsStatement(code, tokens, i) : section !== 'input' && op(next, '(');
      if (token.type === 'name' && call && Object.hasOwn(functions, token.value)) {
        add(token, token, token.value, resolve(functions, token.value));
        handled.add(token);
      }
      return;
    }
    handled.add(token);
    if (depth !== sectionDepth) return;
    const statement = startsStatement(code, tokens, i);
    if (statement) first = token;
    if (token.type !== 'name') return;
    const table = section === 'input' ? qualifiers.inputs : qualifiers.outputs;
    const inTuple = first?.value === 'tuple' && (tokens[i - 1] === first || op(tokens[i - 1], ','));
    if ((statement || inTuple) && Object.hasOwn(table, token.value)) {
      add(token, token, token.value, resolve(table, token.value));
      const target = op(next, '(') ? (op(tokens[i + 3], ')') ? tokens[i + 2] : undefined) : next;
      if (section === 'input' && target?.type === 'name') {
        note(target.value, token.value === 'path' || token.value === 'file' ? 'Path' : undefined);
      }
    } else if (!statement && section === 'output' && op(next, ':')) {
      add(token, token, token.value, resolve(qualifiers.options, token.value));
    }
  });
  return handled;
}

/** The link for a section label of a process. */
function processLabel(tokens: Token[], i: number) {
  const { value } = tokens[i] as Token;
  if (value === 'input' || value === 'output') {
    return legacyAt(tokens, i + 2)
      ? resolve(sections, value, 'process section')
      : resolve(labels.typed, value, 'process section');
  }
  return resolve(value === 'stage' || value === 'topic' ? labels.typed : labels.process, value, 'process section');
}

/** Links `process`, and the directives and section labels of each process body. Adds the process names. */
function processLinks(code: string, tokens: Token[], add: Add, callables: Set<string>) {
  for (let i = 0; i < tokens.length; i++) {
    const name = tokens[i + 1];
    if (tokens[i]?.value !== 'process' || name?.type !== 'name' || tokens[i + 2]?.value !== '{') continue;
    if (!startsStatement(code, tokens, i)) continue;
    add(tokens[i] as Token, tokens[i] as Token, 'process', resolve(keywords, 'process', 'keyword'));
    callables.add(name.value);
    const end = skipBrackets(tokens, i + 2);
    let labelled = false;
    for (let j = i + 3; j < end; j++) {
      const token = tokens[j] as Token;
      if (opens(token)) j = skipBrackets(tokens, j) - 1;
      if (token.type !== 'name' || !startsStatement(code, tokens, j)) continue;
      if (isLabel(code, tokens, j)) {
        labelled = true;
        add(token, token, token.value, processLabel(tokens, j));
      } else if (!labelled && !['=', '.', ':'].includes(tokens[j + 1]?.value ?? '')) {
        add(token, token, token.value, resolve(directives, token.value, 'process directive'));
      }
    }
    i = end - 1;
  }
}

// `enum` and `record` take a name, `workflow` can, and the others do not. `process` is in `processLinks`.
const NAMED = new Set(['enum', 'record']);
const UNNAMED = new Set(['include', 'params', 'output']);

/** Links the keywords that start a declaration, and the section labels of each workflow. Adds the workflow names. */
function keywordLinks(code: string, tokens: Token[], add: Add, callables: Set<string>) {
  tokens.forEach((token, i) => {
    const { value } = token;
    if (token.type !== 'name' || value === 'process' || !Object.hasOwn(keywords, value)) return;
    const named = tokens[i + 1]?.type === 'name' && op(tokens[i + 2], '{');
    if (!(named || op(tokens[i + 1], '{')) || !startsStatement(code, tokens, i)) return;
    if ((NAMED.has(value) && !named) || (UNNAMED.has(value) && named)) return;
    add(token, token, value, resolve(keywords, value, 'keyword'));
    if (value !== 'workflow') return;
    if (named) callables.add(tokens[i + 1]?.value ?? '');
    const open = named ? i + 2 : i + 1;
    for (let j = open + 1, end = skipBrackets(tokens, open) - 1; j < end; j++) {
      const label = tokens[j] as Token;
      if (opens(label)) j = skipBrackets(tokens, j) - 1;
      else if (label.type === 'name' && op(tokens[j + 1], ':') && startsStatement(code, tokens, j)) {
        add(label, label, label.value, resolve(labels.workflow, label.value, 'workflow section'));
      }
    }
  });
}

/** The link for `docker.enabled` or for `enabled` in a `docker` block: the longest setting name it starts. */
function settingLink(code: string, names: Token[], scope: string, add: Add) {
  for (let k = names.length; k > 0; k--) {
    const full = [...(scope ? [scope] : []), ...names.slice(0, k).map((token) => token.value)].join('.');
    if (!Object.hasOwn(settings, full)) continue;
    const [first, last] = [names[0] as Token, names[k - 1] as Token];
    const oneLine = !code.slice(first.start, last.end).includes('\n');
    add(oneLine ? first : last, last, full, resolve(settings, full, 'config setting'));
    return true;
  }
  return false;
}

/** Links feature flags, config settings, config scopes, and directives in the `process` scope. */
function configLinks(code: string, tokens: Token[], add: Add) {
  // What each open bracket holds: '' for settings at the top level and in a profile, a scope name such as `docker`
  // or `aws.batch` for its settings, `process` for directives, `profiles` for profiles, or OTHER for anything else.
  const OTHER = '#';
  const stack: string[] = [];
  let block: string | undefined;
  tokens.forEach((token, i) => {
    if (opens(token)) {
      stack.push(token.value === '{' && block !== undefined ? block : OTHER);
      block = undefined;
      return;
    }
    if (closes(token)) {
      stack.pop();
      return;
    }
    const within = stack.at(-1) ?? '';
    if (within === OTHER || !startsStatement(code, tokens, i)) return;
    block = undefined;
    const { value } = token;
    const next = tokens[i + 1];
    if (within === 'profiles') block = '';
    else if (token.type !== 'name') return;
    else if (within === 'process') {
      if (value === 'withName' || value === 'withLabel') block = 'process';
      else add(token, token, value, resolve(directives, value, 'process directive'));
    } else if (flagLink(code, tokens, i, add) || settingLink(code, dotted(tokens, i), within, add)) {
      return;
    } else if (within) {
      if (op(next, '{') && PREFIXES.has(`${within}.${value}`)) block = `${within}.${value}`;
    } else if (Object.hasOwn(scopes, value)) {
      const member = tokens[i + 2];
      const process = value === 'process';
      const setting =
        op(next, '.') &&
        member?.type === 'name' &&
        (process ? Object.hasOwn(directives, member.value) : !PREFIXES.has(value));
      if (op(next, '{') || setting) add(token, token, value, resolve(scopes, value, 'config scope'));
      if (op(next, '{')) block = value;
      if (process && setting && member) {
        add(member, member, member.value, resolve(directives, member.value, 'process directive'));
      }
    }
  });
}

/** Links the feature flag that starts at `tokens[i]`, such as `nextflow.enable.types`. */
function flagLink(code: string, tokens: Token[], i: number, add: Add) {
  const names = dotted(tokens, i).slice(0, 3);
  const name = names.map((token) => token.value).join('.');
  if (names.length < 3 || !Object.hasOwn(flags, name)) return false;
  const [first, last] = [names[0] as Token, names[2] as Token];
  add(
    code.slice(first.start, last.end).includes('\n') ? last : first,
    last,
    name,
    resolve(flags, name, 'feature flag'),
  );
  return true;
}

/** Links `task.attempt` and the other task properties, and `task.cpus` and the other directive values. */
function taskLink(code: string, tokens: Token[], i: number, add: Add) {
  const [first, member] = [tokens[i] as Token, tokens[i + 2]];
  if (first.value !== 'task' || op(tokens[i - 1], '.') || !op(tokens[i + 1], '.') || member?.type !== 'name') {
    return false;
  }
  const resolution =
    resolve(task, member.value, 'task property') ?? resolve(directives, member.value, 'task directive value');
  if (!resolution) return false;
  const oneLine = !code.slice(first.start, member.end).includes('\n');
  add(oneLine ? first : member, member, `task.${member.value}`, resolution);
  return true;
}

/**
 * Names that the block binds: assigned, declared with `def`, loop variables, and closure and function parameters.
 * Also returns the parameters and loop variables that have no `: Type`.
 */
function boundNames(tokens: Token[]) {
  const bound = new Set<string>();
  const untyped = new Set<string>();
  const parameter = (token: Token, next?: Token) => {
    bound.add(token.value);
    if (!op(next, ':')) untyped.add(token.value);
  };
  // Not the names in default values, such as `params` in `def f(dir = params.outdir)`.
  const parameters = (open: number) => {
    let value = false;
    for (let j = open + 1, end = skipBrackets(tokens, open) - 1; j < end; j++) {
      const token = tokens[j] as Token;
      if (opens(token)) j = skipBrackets(tokens, j) - 1;
      else if (op(token, '=,')) value = token.value === '=';
      else if (!value && token.type === 'name' && !op(tokens[j - 1], ':')) parameter(token, tokens[j + 1]);
    }
  };
  tokens.forEach((token, i) => {
    const prev = tokens[i - 1]?.value;
    const next = tokens[i + 1]?.value;
    if (token.value === '-' && next === '>' && tokens[i + 1]?.start === token.end) {
      let j = i;
      while (tokens[j - 1]?.type === 'name' || [',', ':'].includes(tokens[j - 1]?.value ?? '')) j--;
      for (; j < i; j++) if (tokens[j]?.type === 'name') parameter(tokens[j] as Token, tokens[j + 1]);
    }
    if (token.type !== 'name') return;
    if (prev === '(' && tokens[i - 2]?.value === 'for') parameter(token, tokens[i + 1]);
    if (prev === 'def') bound.add(token.value);
    if (next === '=' && !['=', '~'].includes(tokens[i + 2]?.value ?? '') && prev !== '.') bound.add(token.value);
    if (token.value === 'def') {
      const open = next === '(' ? i + 1 : tokens[i + 2]?.value === '(' ? i + 2 : -1;
      if (open > 0) parameters(open);
    }
  });
  return [bound, untyped] as const;
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
 * Links Nextflow keywords, section labels, qualifiers, directives, channel factories, operators on a channel,
 * processes and workflows from `include` statements, the standard library, and members of the standard library
 * types on values whose type the block shows. In config files, it links feature flags, settings and scopes.
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

  /**
   * What `.name` gives on a value of `type`, and its link. `Outputs` is what a process or workflow call gives: a
   * channel, or one channel for each named output.
   */
  const member = (type: string, name: string): { type?: string; link?: Resolution } => {
    if (type === 'Channel' || type === 'Outputs') {
      if (Object.hasOwn(operators, name)) return { type: 'Channel', link: operator(name) };
      return type === 'Outputs' ? { type: name === 'out' ? 'Outputs' : 'Channel' } : {};
    }
    // Groovy reads `ref.text` as `ref.getText()`.
    const getter = `get${name[0]?.toUpperCase()}${name.slice(1)}`;
    for (const key of [name, getter]) {
      for (const owner of [type, PARENTS[type]]) {
        const members = owner ? types[owner] : undefined;
        if (members && Object.hasOwn(members, key)) {
          return { type: (members[key] as Entry).returns, link: resolve(members, key) };
        }
      }
    }
    return {};
  };

  let warn = (_message: string) => {};

  return {
    name: 'nextflow',
    languages: ['nextflow', 'nf'],
    async setup(context) {
      warn = context.warn;
    },
    findSymbols(code, _language, attributes = {}) {
      const [tokens] = tokenize(code);
      const segments = [tokens, ...interpolations(tokens)];
      const symbols: SymbolRef[] = [];
      const add: Add = (start, end, name, resolution) => {
        if (resolution)
          symbols.push({ ...resolution, name: resolution.name ?? name, start: start.start, end: end.end });
      };

      const file = attributes.nextflow;
      if (file !== undefined && file !== 'config') {
        warn(`nextflow="${file}" is not a file type that the adapter knows, so the adapter ignores it.`);
      }
      // nf-test has its own `workflow` and `file()`.
      if (attributes.title?.endsWith('.nf.test')) return symbols;
      if (file === 'config' || attributes.title?.endsWith('.config')) {
        configLinks(code, tokens, add);
        for (const segment of segments) for (let i = 0; i < segment.length; i++) taskLink(code, segment, i, add);
        return symbols;
      }

      const known = new Map<string, string | null>();
      const note: Note = (name, type) => {
        known.set(name, known.has(name) && known.get(name) !== type ? null : (type ?? null));
      };
      const callables = new Set<string>();
      processLinks(code, tokens, add, callables);
      keywordLinks(code, tokens, add, callables);
      const handled = declarationLinks(code, tokens, add, note);
      const [bound, untyped] = boundNames(tokens);

      // Processes and workflows from `include { A; B as C } from '…'`.
      const included = new Map<string, Resolution>();
      const inInclude = new Set<Token>();
      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i]?.value !== 'include' || tokens[i + 1]?.value !== '{') continue;
        const close = skipBrackets(tokens, i + 1);
        const path = tokens[close]?.value === 'from' ? tokens[close + 1] : undefined;
        if (path?.type !== 'string') continue;
        for (const token of tokens.slice(i, close)) inInclude.add(token);
        for (let j = i + 2; j < close - 1; j++) {
          const name = tokens[j] as Token;
          if (name.type !== 'name') continue;
          const resolution = module({ name: name.value, path: path.value });
          add(name, name, name.value, resolution);
          const alias = tokens[j + 1]?.value === 'as' ? tokens[j + 2] : undefined;
          callables.add(alias?.value ?? name.value);
          if (resolution) included.set(alias?.value ?? name.value, resolution);
          if (alias) j += 2;
        }
        i = close + 1;
      }

      /** The global name or namespace member at `segment[i]`, with the index after its call. */
      const stdlib = (segment: Token[], i: number) => {
        const token = segment[i] as Token;
        const name = segment[i + 2];
        if (bound.has(token.value) || handled.has(token)) return undefined;
        if (Object.hasOwn(namespaces, token.value) && op(segment[i + 1], '.') && name?.type === 'name') {
          const members = namespaces[token.value] as Record<string, Entry>;
          if (!Object.hasOwn(members, name.value)) return undefined;
          const entry = members[name.value] as Entry;
          return { entry, name: `${token.value}.${name.value}`, last: name, after: i + 3 };
        }
        if (!Object.hasOwn(globals, token.value) || !usesGlobal(code, segment, i)) return undefined;
        return { entry: globals[token.value] as Entry, name: token.value, last: token, after: i + 1 };
      };
      /** The type of what a standard library name gives, and the index after it. */
      const stdlibType = (segment: Token[], found: { entry: Entry; after: number }): [string | undefined, number] => {
        const { entry, after } = found;
        if (!entry.signature?.includes('(')) return [entry.returns, after];
        return op(segment[after], '(') ? [entry.returns, skipBrackets(segment, after)] : [undefined, after];
      };

      /** Follows the members after a value of `type` from `segment[i]`. Returns the type at the end and its index. */
      const walk = (segment: Token[], i: number, type: string | undefined, link: boolean) => {
        while (type && op(segment[i], '.') && segment[i + 1]?.type === 'name') {
          const name = segment[i + 1] as Token;
          const next = member(type, name.value);
          if (!next.type && !next.link) return [undefined, i] as const;
          if (link) add(name, name, name.value, next.link);
          type = next.type;
          i = skipCall(segment, i + 2);
        }
        return [type, i] as const;
      };

      /** The type of the expression that starts at `tokens[i]`, if the block shows it, and the index after it. */
      const typeAt = (i: number) => {
        const token = tokens[i];
        let type: string | undefined;
        let end = i + 1;
        if (token?.type === 'string') type = 'String';
        else if (op(token, '[')) {
          end = skipBrackets(tokens, i);
          const map = op(tokens[i + 1], ':') || (tokens[i + 1]?.type !== 'op' && op(tokens[i + 2], ':'));
          type = map ? 'Map' : 'List';
        } else if (token?.type === 'name') {
          const name = tokens[i + 2];
          if (isChannel(token) && op(tokens[i + 1], '.') && name && Object.hasOwn(factories, name.value)) {
            [type, end] = ['Channel', skipCall(tokens, i + 3)];
          } else if (callables.has(token.value)) {
            type = 'Outputs';
            if (op(tokens[i + 1], '(')) end = skipBrackets(tokens, i + 1);
          } else if (known.has(token.value)) {
            type = known.get(token.value) ?? undefined;
          } else {
            const found = stdlib(tokens, i);
            if (found) [type, end] = stdlibType(tokens, found);
          }
        }
        return walk(tokens, end, type, false);
      };

      // Variable types: from `name: Type` declarations and legacy `path` inputs, then from each assignment in
      // order, and from `set` and `tap`. A parameter without a type has none.
      tokens.forEach((token, i) => {
        const type = tokens[i + 2];
        if (token.type !== 'name' || !op(tokens[i + 1], ':') || op(tokens[i - 1], '?') || type?.type !== 'name') return;
        if (TYPES.has(type.value)) note(token.value, type.value === 'Value' ? 'Channel' : type.value);
      });
      for (const name of untyped) note(name);
      tokens.forEach((token, i) => {
        if (token.type !== 'name') return;
        const next = tokens[i + 1]?.value;
        if (!op(tokens[i - 1], '.') && next === '=' && !['=', '~'].includes(tokens[i + 2]?.value ?? '')) {
          const [type, end] = typeAt(i + 2);
          const lenient = type === 'Channel' || type === 'Outputs';
          note(token.value, lenient || endsStatement(code, tokens, end) ? type : undefined);
        }
        const target = tokens[i + 2];
        if (['set', 'tap'].includes(token.value) && op(tokens[i - 1], '.') && next === '{') {
          if (target?.type === 'name' && tokens[i + 3]?.value === '}' && !known.has(target.value)) {
            note(target.value, 'Channel');
          }
        }
      });

      for (const segment of segments) {
        segment.forEach((token, i) => {
          if (token.type !== 'name' || op(segment[i - 1], '.') || inInclude.has(token)) return;
          const next = segment[i + 1];
          const name = segment[i + 2];
          if (isChannel(token) && op(next, '.') && name && Object.hasOwn(factories, name.value)) {
            // One link for `channel.of`, unless a line break splits it.
            const oneLine = !code.slice(token.start, name.end).includes('\n');
            add(oneLine ? token : name, name, `channel.${name.value}`, factory(name.value));
            walk(segment, skipCall(segment, i + 3), 'Channel', true);
          } else if (flagLink(code, segment, i, add) || taskLink(code, segment, i, add)) {
            return;
          } else if (callables.has(token.value)) {
            add(token, token, token.value, included.get(token.value));
            walk(segment, i + 1, 'Outputs', true);
          } else if (known.get(token.value)) {
            walk(segment, i + 1, known.get(token.value) ?? undefined, true);
          } else {
            const found = stdlib(segment, i);
            if (!found) return;
            const oneLine = !code.slice(token.start, found.last.end).includes('\n');
            add(oneLine ? token : found.last, found.last, found.name, link(found.entry));
            const [type, after] = stdlibType(segment, found);
            walk(segment, after, type, true);
          }
        });
      }
      return symbols;
    },
  };
}

export default nextflow;
