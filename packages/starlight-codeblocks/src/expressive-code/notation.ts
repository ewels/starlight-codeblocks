import { AttachedPluginData, type ExpressiveCodeBlock, type ExpressiveCodeLine } from '@expressive-code/core';
import { type CommentSyntax, commentSyntaxFor } from './comments.ts';
import { type CodeblocksPlugin, lineData, lineElement, numberedLines, resolveRange, warn } from './core.ts';

export interface DirectiveSpec {
  /** The directive takes the text after it, up to the next directive or the end of the comment. */
  text?: boolean;
  /** For the directives reference page. */
  docs?: {
    description: string;
    /** What goes after the name, if anything. */
    args?: string;
    /** A small code block that shows only this directive. */
    example: { lang: string; code: string };
    page: string;
  };
}

/** Directive specs by name: `code <name>` for `[!code <name>]`, the bare name for the others. */
export type DirectiveSpecs = Record<string, DirectiveSpec>;

export interface Directive {
  name: string;
  /** From `[!code <name>:N]`. 1 when there is no `:N`. */
  count: number;
  /** The literal text between slashes, as in `[!callout /text/]`. */
  match?: string;
  args: string[];
  text?: string;
  /** The line of the directive in the code block source, from 1. */
  sourceLine: number;
}

export interface ParsedLine {
  text: string;
  /** The line holds only directives. Its directives moved to the line below. */
  removed: boolean;
  directives: Directive[];
}

type Report = (message: string, sourceLine: number) => void;

type Part = { word: string } | { literal: string };

interface Token {
  start: number;
  end: number;
  escaped: boolean;
  parts: Part[];
}

/** Reads `[!name …]` or `[\!name …]` at `start`. Text between the first pair of slashes can hold spaces and `]`. */
function scanToken(s: string, start: number): Token | undefined {
  let i = start + 1;
  const escaped = s[i] === '\\';
  if (escaped) i++;
  if (s[i] !== '!' || !/[a-z]/i.test(s[i + 1] ?? '')) return undefined;
  i++;
  const parts: Part[] = [];
  let word = '';
  while (i < s.length) {
    const c = s[i] as string;
    if (c === ']' || /\s/.test(c)) {
      if (word) parts.push({ word });
      word = '';
      if (c === ']') return { start, end: i + 1, escaped, parts };
      i++;
    } else if (c === '/' && word === '' && !parts.some((part) => 'literal' in part)) {
      // Only the first `/…/` is literal text, so that a later word can be a path, as in `[!link /x/ /docs/]`.
      let literal = '';
      for (i++; i < s.length && s[i] !== '/'; i++) {
        if (s[i] === '\\' && s[i + 1] === '/') i++;
        literal += s[i];
      }
      if (i >= s.length) return undefined;
      parts.push({ literal });
      i++;
    } else {
      word += c;
      i++;
    }
  }
  return undefined;
}

function scanTokens(s: string): Token[] {
  const tokens: Token[] = [];
  for (let i = s.indexOf('['); i !== -1; i = s.indexOf('[', i + 1)) {
    const token = scanToken(s, i);
    if (token) {
      tokens.push(token);
      i = token.end - 1;
    }
  }
  return tokens;
}

const unescapeDirectives = (s: string) => {
  let result = '';
  let cursor = 0;
  for (const token of scanTokens(s).filter((t) => t.escaped)) {
    result += `${s.slice(cursor, token.start)}[${s.slice(token.start + 2, token.end)}`;
    cursor = token.end;
  }
  return result + s.slice(cursor);
};

function interpret(token: Token, specs: DirectiveSpecs, sourceLine: number) {
  const [head, ...rest] = token.parts;
  const name = head && 'word' in head ? head.word : '';
  if (name === 'code') {
    // `[!code focus ++]` holds several directives, each with its own optional `:N`.
    if (rest.length === 0) return { problem: 'needs a name, such as `[!code focus]`' };
    const items: { spec: DirectiveSpec; directive: Directive }[] = [];
    for (const part of rest) {
      const match = 'word' in part ? part.word.match(/^(.+?)(?::(\d+))?$/) : null;
      if (!match?.[1]) return { problem: 'needs a name, such as `[!code focus]`' };
      if (match[1].includes(':')) return { problem: 'needs a count of 1 or more after the colon, such as `:3`' };
      const count = match[2] === undefined ? 1 : Number(match[2]);
      if (count < 1) return { problem: 'needs a count of 1 or more after the colon, such as `:3`' };
      const spec = Object.hasOwn(specs, `code ${match[1]}`) ? specs[`code ${match[1]}`] : undefined;
      if (!spec) return { problem: 'is not a known directive' };
      items.push({ spec, directive: { name: `code ${match[1]}`, count, args: [], sourceLine } });
    }
    return { items };
  }
  const spec = Object.hasOwn(specs, name) ? specs[name] : undefined;
  if (!spec) return { problem: 'is not a known directive' };
  const match = rest.find((part) => 'literal' in part);
  const directive: Directive = {
    name,
    count: 1,
    args: rest.filter((part) => part !== match).map((part) => ('word' in part ? part.word : part.literal)),
    sourceLine,
  };
  if (match && 'literal' in match) directive.match = match.literal;
  return { items: [{ spec, directive }] };
}

/**
 * Whether the comment opener at `index` is inside a quoted string, before any comment, that also holds
 * the directive at `first`. An approximation, as in `findBrackets`: a quote with no partner (a Rust lifetime),
 * or whose partner is an apostrophe between the opener and the directive, is not a string.
 */
function inString(text: string, index: number, first: number, syntaxes: CommentSyntax[]) {
  for (let i = 0; i < index; i++) {
    if (syntaxes.some(({ open }) => text.startsWith(open, i))) return false;
    const quote = text[i];
    if (quote !== '"' && quote !== "'" && quote !== '`') continue;
    let j = i + 1;
    while (j < text.length && text[j] !== quote) j += text[j] === '\\' ? 2 : 1;
    if (j >= text.length || (index < j && j < first && /\w'\w/.test(text.slice(j - 1, j + 2)))) continue;
    if (index < j) return true;
    i = j;
  }
  return false;
}

/** Finds the comment that holds the first directive, as [opener start, body start, body end, comment end]. */
function findComment(text: string, first: number, syntaxes: CommentSyntax[]) {
  let best: [number, number, number, number] | undefined;
  let bestClosed = false;
  for (const { open, close } of syntaxes) {
    let start = first - open.length < 0 ? -1 : text.lastIndexOf(open, first - open.length);
    // A line that opens with a line comment is all comment, even when its text holds the opener (`# see #12`).
    const lead = close
      ? undefined
      : [/^\s*/, /^[+-]\s*/]
          .map((re) => text.match(re)?.[0].length ?? -1)
          .find((i) => i >= 0 && i < start && text.startsWith(open, i));
    if (lead !== undefined) start = lead;
    if (start === -1 || inString(text, start, first, syntaxes)) continue;
    const bodyStart = start + open.length;
    const closeAt = close ? text.indexOf(close, bodyStart) : -1;
    if (close && closeAt !== -1 && closeAt < first) continue;
    const closed = closeAt !== -1;
    // `{/* */}` and `/* */` share a body: the longer one wins when its closer is on the line too.
    if (
      best &&
      (bodyStart < best[1] || (bodyStart === best[1] && (closed === bestClosed ? start >= best[0] : !closed)))
    )
      continue;
    bestClosed = closed;
    best =
      closeAt === -1 || !close
        ? [start, bodyStart, text.length, text.length]
        : [start, bodyStart, closeAt, closeAt + close.length];
  }
  return best;
}

/** Parses the directives in one line and returns the line without them. */
export function parseLine(
  text: string,
  syntaxes: CommentSyntax[],
  specs: DirectiveSpecs,
  report: Report,
  sourceLine = 1,
  diff = false,
): ParsedLine {
  const unchanged = { text, removed: false, directives: [] };
  // A `[!word]` in code or in a string, such as a Markdown alert, comes before the comment that holds the directives.
  let comment: ReturnType<typeof findComment>;
  const tokens = scanTokens(text);
  for (const token of tokens) {
    comment = findComment(text, token.start, syntaxes);
    if (comment) break;
  }
  if (!comment) {
    // A string can show a directive on purpose, and `[\!` only unescapes inside a comment.
    for (const token of tokens) {
      if (token.escaped || inString(text, token.start, token.start, [])) continue;
      if ('problem' in interpret(token, specs, sourceLine)) continue;
      const use = syntaxes.map(({ open, close }) => `\`${close ? `${open} ${close}` : open}\``).join(' or ');
      report(
        `\`${text.slice(token.start, token.end)}\` is not in a comment that this block reads. Use ${use}. It shows as text.`,
        sourceLine,
      );
    }
    return unchanged;
  }
  const [start, bodyStart, bodyEnd, end] = comment;
  const body = text.slice(bodyStart, bodyEnd);
  // Expressive Code strips a diff prefix only later, so `+ // [!code …]` still holds only directives.
  const prefix = diff ? (text.match(/^[+-](?![+-])/)?.[0].length ?? 0) : 0;
  const hasCode = text.slice(prefix, start).trim() !== '' || text.slice(end).trim() !== '';

  const directives: Directive[] = [];
  let remaining = '';
  let cursor = 0;
  let textOf: Directive | undefined;
  let removedBefore = false;
  const keep = (segment: string) => {
    remaining += removedBefore && /\s$/.test(remaining) ? segment.trimStart() : segment;
    removedBefore = false;
  };
  for (const token of scanTokens(body).filter((t) => !t.escaped)) {
    const segment = body.slice(cursor, token.start);
    if (textOf) textOf.text = unescapeDirectives(segment).trim() || undefined;
    else keep(segment);
    textOf = undefined;
    cursor = token.end;
    const raw = body.slice(token.start, token.end);
    const result = interpret(token, specs, sourceLine);
    if ('problem' in result) {
      report(`\`${raw}\` ${result.problem}. The line renders without it.`, sourceLine);
      keep(raw);
      continue;
    }
    for (const { spec, directive } of result.items) {
      directives.push(directive);
      // In `[!code ++ error] text`, the text goes to the first directive that takes text.
      if (spec.text) textOf ??= directive;
    }
    removedBefore = true;
  }
  const tail = body.slice(cursor);
  if (textOf) textOf.text = unescapeDirectives(tail).trim() || undefined;
  else keep(tail);

  remaining = unescapeDirectives(remaining);
  // A line that holds only directives goes, as in Shiki's notation transformers.
  if (!hasCode && directives.length > 0 && remaining.trim() === '') return { text: '', removed: true, directives };
  const before = text.slice(0, start);
  const after = text.slice(end);
  const newText =
    directives.length > 0 && remaining.trim() === ''
      ? before.trim() === ''
        ? after.trim() === ''
          ? ''
          : before + after.trimStart()
        : before.trimEnd() + after
      : text.slice(0, bodyStart) +
        (directives.length > 0 ? remaining.trimEnd() + (body.match(/\s*$/)?.[0] ?? '') : remaining) +
        text.slice(bodyEnd);
  return { text: newText, removed: false, directives };
}

/** Parses every line, and moves the directives of removed lines to the line below them. */
export function parseNotation(
  lines: string[],
  syntaxes: CommentSyntax[],
  specs: DirectiveSpecs,
  report: Report,
  diff = false,
): ParsedLine[] {
  const parsed = lines.map((text, i) => parseLine(text, syntaxes, specs, report, i + 1, diff));
  let pending: Directive[] = [];
  for (const line of parsed) {
    if (line.removed) {
      pending.push(...line.directives);
      line.directives = [];
    } else if (pending.length > 0) {
      line.directives.unshift(...pending);
      pending = [];
    }
    line.directives = line.directives.filter((directive) => {
      if (directive.match === undefined || line.text.includes(directive.match)) return true;
      report(
        `\`/${directive.match}/\` in \`[!${directive.name}]\` does not match the line it applies to. The line renders without it.`,
        directive.sourceLine,
      );
      return false;
    });
  }
  for (const directive of pending) {
    report(`\`[!${directive.name}]\` has no line below it.`, directive.sourceLine);
  }
  return parsed;
}

export interface BlockDirective extends Directive {
  /** The line the directive applies to, then the next `count - 1` lines. */
  lines: ExpressiveCodeLine[];
}

const notationData = new AttachedPluginData<{
  directives: BlockDirective[];
  removed: ExpressiveCodeLine[];
  specs: DirectiveSpecs;
  diffIndent: Map<ExpressiveCodeLine, number>;
}>(() => ({ directives: [], removed: [], specs: {}, diffIndent: new Map() }));

/** The directives in a code block, optionally only those with one name, such as `code focus`. */
export function getDirectives(codeBlock: ExpressiveCodeBlock, name?: string): BlockDirective[] {
  const { directives } = notationData.getOrCreateFor(codeBlock);
  return name === undefined ? directives : directives.filter((directive) => directive.name === name);
}

/** The lines of the range attribute `key`, such as `focus={2}`, and the lines of the `name` directives. */
export function markedLines(context: Parameters<typeof resolveRange>[0], key: string, name: string) {
  return new Set([
    ...(resolveRange(context, key) ?? []),
    ...getDirectives(context.codeBlock, name).flatMap((d) => d.lines),
  ]);
}

/**
 * The directives named `name` whose line is rendered, for `postprocessRenderedBlock`. Warns about the others:
 * another plugin, such as Twoslash, removed their line after the notation plugin read them.
 */
export function getRenderedDirectives(context: Parameters<typeof warn>[0], name: string): BlockDirective[] {
  return getDirectives(context.codeBlock, name).filter((directive) => {
    const [line] = directive.lines;
    if (!line || lineElement(line)) return !!line;
    warn(context, `\`[!${name}]\` is dropped: another plugin removed its line.`, directive.sourceLine);
    return false;
  });
}

const markers: Record<string, [marker: string, change: string]> = {
  'code highlight': ['mark', 'highlighted'],
  'code ++': ['ins', 'inserted'],
  'code --': ['del', 'deleted'],
};

export const builtInDirectives: DirectiveSpecs = Object.fromEntries(
  Object.entries(markers).map(([name, [marker, change]]) => [
    name,
    {
      docs: {
        description: `Marks the line as ${change}, like the \`${marker}\` attribute of Expressive Code. With line states on, text after the directive shows as a message.`,
        example: { lang: 'js', code: `const host = 'localhost'\nconst port = 8080 // [!${name}]` },
        page: 'comment-notation',
      },
    },
  ]),
);

export interface NotationOptions {
  comments?: Record<string, string[]>;
}

/**
 * Reads directives in comments, removes them from the code, and keeps them for the other features.
 * Every feature declares its directives in the `directives` property of its plugin.
 */
export function pluginNotation({ comments }: NotationOptions = {}): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:notation',
    directives: builtInDirectives,
    hooks: {
      // Runs before `preprocessMetadata`, so that Expressive Code's own markers
      // and every range attribute can count the lines that readers see.
      preprocessLanguage(context) {
        const { codeBlock, config } = context;
        const syntaxes = commentSyntaxFor(codeBlock.language, comments);
        if (syntaxes.length === 0 || !/\[\\?!/.test(codeBlock.code)) return;
        const specs: DirectiveSpecs = Object.assign(
          {},
          ...config.plugins.map((plugin) => (plugin as CodeblocksPlugin).directives ?? {}),
        );
        const lines = codeBlock.getLines();
        const parsed = parseNotation(
          lines.map((line) => line.text),
          syntaxes,
          specs,
          (message, line) => warn(context, message, line),
          // The text markers plugin reads the `useDiffSyntax` meta option only in `preprocessMetadata`.
          codeBlock.metaOptions.getBoolean('useDiffSyntax') ?? Boolean(codeBlock.props.useDiffSyntax),
        );
        const visible = lines.filter((_, i) => !parsed[i]?.removed);
        lineData.getOrCreateFor(codeBlock).lines = visible;
        const data = notationData.getOrCreateFor(codeBlock);
        data.specs = specs;
        data.removed = lines.filter((_, i) => parsed[i]?.removed);
        if (data.removed.length > 0) remapCollapse(codeBlock, lines, visible);
        parsed.forEach(({ directives }, i) => {
          const target = visible.indexOf(lines[i] as ExpressiveCodeLine);
          for (const directive of directives) {
            data.directives.push({ ...directive, lines: visible.slice(target, target + directive.count) });
            if (target + directive.count > visible.length) {
              warn(context, `\`:${directive.count}\` runs past the last line of the block.`, directive.sourceLine);
            }
            const marker = markers[directive.name]?.[0];
            if (marker) addMarkerLines(codeBlock, marker, target + 1, directive.count);
          }
        });
      },
      preprocessMetadata({ codeBlock }) {
        const { removed } = notationData.getOrCreateFor(codeBlock);
        if (removed.length === 0) return;
        // Plugins before this one attached their line annotations by source line.
        const lines = codeBlock.getLines();
        const visible = numberedLines(codeBlock);
        const moves = lines.map((line, i) => [line, visible[i], line.getAnnotations()] as const);
        for (const [line, target, annotations] of moves) {
          if (target === line) continue;
          for (const annotation of annotations) {
            line.deleteAnnotation(annotation);
            target?.addAnnotation(annotation);
          }
        }
        if (codeBlock.props.useDiffSyntax) {
          notationData.getOrCreateFor(codeBlock).diffIndent = diffIndentFix(lines, visible);
        }
      },
      preprocessCode({ codeBlock }) {
        const syntaxes = commentSyntaxFor(codeBlock.language, comments);
        const { removed, specs, diffIndent } = notationData.getOrCreateFor(codeBlock);
        if (syntaxes.length === 0 || !/\[\\?!/.test(codeBlock.code)) return;
        for (const [line, columns] of diffIndent) line.editText(0, columns, '');
        for (const line of codeBlock.getLines()) {
          // Other plugins can edit lines after the first parse, so parse the current text again.
          const { text, removed: gone } = parseLine(line.text, syntaxes, specs, () => {});
          // The first parse kept this line, and blanking it would leave an empty line behind.
          if (gone && !removed.includes(line)) continue;
          if (text !== line.text) line.editText(0, line.text.length, text);
        }
        for (const line of removed) {
          const index = codeBlock.getLines().indexOf(line);
          if (index !== -1) codeBlock.deleteLine(index);
        }
      },
    },
  };
}

const diffLine = /^(([+-](?![+-]))?\s*)(.*)$/;

/** The columns that Expressive Code's diff syntax removes from each line, as in its text markers plugin. */
function diffColumns(lines: readonly ExpressiveCodeLine[]) {
  if (lines.slice(0, 4).some((line) => /^([*+-]{3}\s|@@\s|[0-9,]+[acd][0-9,]+\s*$)/.test(line.text))) return undefined;
  const parsed = lines.map((line) => line.text.match(diffLine) ?? []);
  const indents = parsed.filter((m) => m[3]?.trim()).map((m) => m[1]?.length ?? 0);
  const min = indents.length > 0 ? Math.min(...indents) : 0;
  return new Map(lines.map((line, i) => [line, min || (parsed[i]?.[2] ? 1 : 0)]));
}

/**
 * The diff syntax measures the indentation in `preprocessCode`, before this plugin can delete the removed lines,
 * so a removed line with less indentation keeps the indentation of the others. The extra columns to remove.
 */
function diffIndentFix(lines: readonly ExpressiveCodeLine[], visible: readonly ExpressiveCodeLine[]) {
  const fix = new Map<ExpressiveCodeLine, number>();
  const all = diffColumns(lines);
  const seen = diffColumns(visible);
  if (!all || !seen) return fix;
  for (const [line, columns] of seen) {
    const extra = columns - (all.get(line) ?? 0);
    if (extra > 0) fix.set(line, extra);
  }
  return fix;
}

function addMarkerLines(codeBlock: ExpressiveCodeBlock, marker: string, first: number, count: number) {
  const props = codeBlock.props as Record<string, unknown>;
  const existing = props[marker];
  const definitions = existing === undefined ? [] : Array.isArray(existing) ? existing : [existing];
  for (let n = first; n < first + count; n++) definitions.push(n);
  props[marker] = definitions;
}

/**
 * Expressive Code's collapsible sections plugin keeps the source lines of `collapse={…}` in `preprocessMetadata`,
 * while lines that hold only directives are still there. Turns the lines that readers see into source lines before that.
 */
function remapCollapse(
  codeBlock: ExpressiveCodeBlock,
  lines: readonly ExpressiveCodeLine[],
  visible: readonly ExpressiveCodeLine[],
) {
  const props = codeBlock.props as Record<string, unknown>;
  const options = codeBlock.metaOptions.list('collapse', 'range');
  if (props.collapse === undefined && options.length === 0) return;
  const existing =
    props.collapse === undefined ? [] : Array.isArray(props.collapse) ? props.collapse : [props.collapse];
  const toSource = (n: number) => {
    const line = visible[n - 1];
    return line ? lines.indexOf(line) + 1 : n + lines.length - visible.length;
  };
  props.collapse = [...existing, ...options.map((option) => option.value)].map((range) =>
    String(range).replace(/\d+/g, (n) => String(toSource(Number(n)))),
  );
  for (const option of options) codeBlock.meta = codeBlock.meta.replace(option.raw, '');
}
