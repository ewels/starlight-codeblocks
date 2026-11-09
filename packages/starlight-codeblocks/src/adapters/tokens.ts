/** The index after the string whose opening `quote` ends before `i`. An unclosed one-line string ends at the line. */
export function stringEnd(code: string, i: number, quote: string) {
  while (i < code.length && !code.startsWith(quote, i)) {
    if (code[i] === '\\') i++;
    else if (quote.length === 1 && code[i] === '\n') return i;
    i++;
  }
  return Math.min(i + quote.length, code.length);
}

/** The index after the brackets that open at `tokens[i]`. String tokens never count as brackets. */
export function skipBrackets(tokens: { type: string; value: string }[], i: number) {
  let depth = 0;
  for (; i < tokens.length; i++) {
    if (tokens[i]?.type === 'string') continue;
    const value = tokens[i]?.value;
    if (value === '(' || value === '[' || value === '{') depth++;
    if (value === ')' || value === ']' || value === '}') depth--;
    if (depth === 0) return i + 1;
  }
  return i;
}

export interface Token {
  type: 'name' | 'op' | 'string';
  value: string;
  start: number;
  end: number;
  /** The code in each `$name` and `${…}` of an interpolated string. */
  parts?: Token[][];
}

/** How a language writes comments and strings. `/* … *\/` is always a comment. */
export interface Syntax {
  /** Line comment markers, such as `//` and `#`. */
  comments: string[];
  /** String quotes, such as `"` and `'''`. */
  quotes: string[];
  /** The quotes whose strings hold code in `$name` and `${…}`. */
  interpolated?: string[];
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = new WeakMap<Syntax, RegExp>();
const INTERPOLATED = /[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/y;

function pattern(syntax: Syntax) {
  let regex = patterns.get(syntax);
  if (!regex) {
    const comments = syntax.comments.map((marker) => `${escapeRegExp(marker)}[^\\n]*`);
    // Longest quote first, so that `'''` is not read as an empty `''` string.
    const quotes = [...syntax.quotes].sort((a, b) => b.length - a.length).map(escapeRegExp);
    regex = new RegExp(
      `(${[...comments, '\\/\\*[\\s\\S]*?(?:\\*\\/|$)'].join('|')})|(${quotes.join('|') || '(?!)'})|([A-Za-z_$][\\w$]*)|(\\d[\\w.]*|\\s+)|(.)`,
      'y',
    );
    patterns.set(syntax, regex);
  }
  return regex;
}

/**
 * Splits code into names, operators and strings, from `i`. Comments are left out. With `inner`, it stops after the
 * `}` that closes a `${`. Returns the tokens and the index where it stopped.
 */
export function tokenize(code: string, syntax: Syntax, i = 0, inner = false): [Token[], number] {
  const regex = pattern(syntax);
  const tokens: Token[] = [];
  let depth = 0;
  while (i < code.length) {
    regex.lastIndex = i;
    const [match = '', , quote, name, , op] = regex.exec(code) ?? [];
    const start = i;
    i += match.length || 1;
    if (quote) {
      const parts: Token[][] = [];
      i = syntax.interpolated?.includes(quote)
        ? interpolatedEnd(code, syntax, i, quote, parts)
        : stringEnd(code, i, quote);
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
 * The index after the interpolated string whose `quote` ends before `i`. Adds the tokens of each `$name` and
 * `${…}` to `parts`. A `${…}` can span lines, also in a one-line string.
 */
function interpolatedEnd(code: string, syntax: Syntax, i: number, quote: string, parts: Token[][]) {
  while (i < code.length && !code.startsWith(quote, i)) {
    if (code[i] === '\\') {
      i += 2;
    } else if (code.startsWith('${', i)) {
      const [tokens, end] = tokenize(code, syntax, i + 2, true);
      parts.push(tokens);
      i = end;
    } else if (code[i] === '$') {
      INTERPOLATED.lastIndex = i + 1;
      const end = INTERPOLATED.test(code) ? INTERPOLATED.lastIndex : i + 1;
      if (end > i + 1) parts.push(tokenize(code.slice(0, end), syntax, i + 1)[0]);
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
export const interpolations = (tokens: Token[]): Token[][] =>
  tokens.flatMap((token) => (token.parts ?? []).flatMap((part) => [part, ...interpolations(part)]));

// A string token's value is its content, so `'{'` must not count as `{`.
export const op = (token: Token | undefined, chars: string) => token?.type === 'op' && chars.includes(token.value);
export const opens = (token: Token) => op(token, '([{');
export const closes = (token: Token) => op(token, ')]}');

/** The index after the arguments and closure of a call whose name ends before `tokens[i]`. */
export function skipCall(tokens: Token[], i: number) {
  if (op(tokens[i], '(')) i = skipBrackets(tokens, i);
  if (op(tokens[i], '{')) i = skipBrackets(tokens, i);
  return i;
}

/** The names of the dotted name that starts at `tokens[i]`, such as `docker` and `enabled`. */
export function dotted(tokens: Token[], i: number) {
  const names = [tokens[i] as Token];
  for (let j = i; op(tokens[j + 1], '.') && tokens[j + 2]?.type === 'name'; j += 2) names.push(tokens[j + 2] as Token);
  return names;
}

/** Whether `tokens[i]` starts a statement: it follows `{` or `;`, or starts a line that does not continue a list. */
export function startsStatement(code: string, tokens: Token[], i: number) {
  const prev = tokens[i - 1];
  if (!prev || op(prev, '{;')) return true;
  return !op(prev, ',') && code.slice(prev.end, tokens[i]?.start).includes('\n');
}

/** Whether the expression that ends before `tokens[i]` ends its statement. */
export function endsStatement(code: string, tokens: Token[], i: number) {
  const next = tokens[i];
  if (!next || op(next, ';})')) return true;
  return code.slice(tokens[i - 1]?.end, next.start).includes('\n') && !op(next, '.?:+-*/|&=<>');
}
