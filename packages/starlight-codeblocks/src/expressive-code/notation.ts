import { AttachedPluginData, type ExpressiveCodeBlock, type ExpressiveCodeLine } from '@expressive-code/core';
import { type CommentSyntax, commentSyntaxFor } from './comments.ts';
import { type CodeblocksPlugin, lineData, warn } from './core.ts';

export interface DirectiveSpec {
  /** `own`: the directive takes a whole line, and applies to the line below it. */
  placement: 'end' | 'own';
  /** The directive takes the text after it, up to the next directive or the end of the comment. */
  text?: boolean;
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
  /** The line holds only own-line directives. Its directives moved to the line below. */
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

/** Reads `[!name …]` or `[\!name …]` at `start`. Text between slashes can hold spaces and `]`. */
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
    } else if (c === '/' && word === '') {
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
  let name = head && 'word' in head ? head.word : '';
  let count = 1;
  if (name === 'code') {
    const sub = rest.shift();
    const match = sub && 'word' in sub ? sub.word.match(/^(.+?)(?::(\d+))?$/) : null;
    if (!match?.[1]) return { problem: 'needs a name, such as `[!code focus]`' };
    if (match[1].includes(':')) return { problem: 'needs a count of 1 or more after the colon, such as `:3`' };
    name = `code ${match[1]}`;
    count = match[2] === undefined ? 1 : Number(match[2]);
    if (count < 1) return { problem: 'needs a count of 1 or more after the colon, such as `:3`' };
  }
  const spec = specs[name];
  if (!spec) return { problem: 'is not a known directive' };
  const match = rest.find((part) => 'literal' in part);
  const directive: Directive = {
    name,
    count,
    args: rest.filter((part) => part !== match).map((part) => ('word' in part ? part.word : part.literal)),
    sourceLine,
  };
  if (match && 'literal' in match) directive.match = match.literal;
  return { spec, directive };
}

/** Finds the comment that holds the first directive, as [opener start, body start, body end, comment end]. */
function findComment(text: string, first: number, syntaxes: CommentSyntax[]) {
  let best: [number, number, number, number] | undefined;
  for (const { open, close } of syntaxes) {
    const start = first - open.length < 0 ? -1 : text.lastIndexOf(open, first - open.length);
    if (start === -1 || (best && start <= best[0])) continue;
    const bodyStart = start + open.length;
    const closeAt = close ? text.indexOf(close, bodyStart) : -1;
    if (close && closeAt !== -1 && closeAt < first) continue;
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
): ParsedLine {
  const unchanged = { text, removed: false, directives: [] };
  const first = scanTokens(text)[0];
  if (!first) return unchanged;
  const comment = findComment(text, first.start, syntaxes);
  if (!comment) return unchanged;
  const [start, bodyStart, bodyEnd, end] = comment;
  const body = text.slice(bodyStart, bodyEnd);
  const hasCode = text.slice(0, start).trim() !== '' || text.slice(end).trim() !== '';

  const directives: Directive[] = [];
  let own = false;
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
    if (result.spec.placement === 'own' && hasCode) {
      report(`\`${raw}\` must be on a line of its own, above the line it applies to.`, sourceLine);
      keep(raw);
      continue;
    }
    directives.push(result.directive);
    own ||= result.spec.placement === 'own';
    if (result.spec.text) textOf = result.directive;
    removedBefore = true;
  }
  const tail = body.slice(cursor);
  if (textOf) textOf.text = unescapeDirectives(tail).trim() || undefined;
  else keep(tail);

  remaining = unescapeDirectives(remaining);
  if (own) return { text: '', removed: true, directives };
  const newText =
    directives.length > 0 && remaining.trim() === ''
      ? text.slice(0, start).trimEnd() + text.slice(end)
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
): ParsedLine[] {
  const parsed = lines.map((text, i) => parseLine(text, syntaxes, specs, report, i + 1));
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
}>(() => ({ directives: [], removed: [], specs: {} }));

/** The directives in a code block, optionally only those with one name, such as `code focus`. */
export function getDirectives(codeBlock: ExpressiveCodeBlock, name?: string): BlockDirective[] {
  const { directives } = notationData.getOrCreateFor(codeBlock);
  return name === undefined ? directives : directives.filter((directive) => directive.name === name);
}

const markers = { 'code highlight': 'mark', 'code ++': 'ins', 'code --': 'del' } as const;

const builtInDirectives: DirectiveSpecs = Object.fromEntries(
  Object.keys(markers).map((name) => [name, { placement: 'end' }]),
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
        );
        const visible = lines.filter((_, i) => !parsed[i]?.removed);
        lineData.getOrCreateFor(codeBlock).lines = visible;
        const data = notationData.getOrCreateFor(codeBlock);
        data.specs = specs;
        data.removed = lines.filter((_, i) => parsed[i]?.removed);
        parsed.forEach(({ directives }, i) => {
          const target = visible.indexOf(lines[i] as ExpressiveCodeLine);
          for (const directive of directives) {
            data.directives.push({ ...directive, lines: visible.slice(target, target + directive.count) });
            if (target + directive.count > visible.length) {
              warn(context, `\`:${directive.count}\` runs past the last line of the block.`, directive.sourceLine);
            }
            const marker = markers[directive.name as keyof typeof markers];
            if (marker) addMarkerLines(codeBlock, marker, target + 1, directive.count);
          }
        });
      },
      preprocessMetadata({ codeBlock }) {
        const { removed } = notationData.getOrCreateFor(codeBlock);
        if (removed.length === 0) return;
        // Plugins before this one attached their line annotations by source line.
        const lines = codeBlock.getLines();
        const visible = lines.filter((line) => !removed.includes(line));
        const moves = lines.map((line, i) => [line, visible[i], line.getAnnotations()] as const);
        for (const [line, target, annotations] of moves) {
          if (target === line) continue;
          for (const annotation of annotations) {
            line.deleteAnnotation(annotation);
            target?.addAnnotation(annotation);
          }
        }
      },
      preprocessCode({ codeBlock }) {
        const syntaxes = commentSyntaxFor(codeBlock.language, comments);
        const { removed, specs } = notationData.getOrCreateFor(codeBlock);
        if (syntaxes.length === 0 || !/\[\\?!/.test(codeBlock.code)) return;
        for (const line of codeBlock.getLines()) {
          // Other plugins can edit lines after the first parse, so parse the current text again.
          const { text } = parseLine(line.text, syntaxes, specs, () => {});
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

function addMarkerLines(codeBlock: ExpressiveCodeBlock, marker: string, first: number, count: number) {
  const props = codeBlock.props as Record<string, unknown>;
  const existing = props[marker];
  const definitions = existing === undefined ? [] : Array.isArray(existing) ? existing : [existing];
  for (let n = first; n < first + count; n++) definitions.push(n);
  props[marker] = definitions;
}
