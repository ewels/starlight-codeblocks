import {
  type AnnotationRenderOptions,
  ExpressiveCodeAnnotation,
  type ExpressiveCodeLine,
  InlineStyleAnnotation,
  PluginStyleSettings,
  type StyleResolverFn,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { h, select } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { type CommentSyntax, commentSyntaxFor } from './comments.ts';
import { type CodeblocksPlugin, languageId } from './core.ts';
import { onCode, PREFIX } from './styles.ts';

export interface BracketsStyleSettings {
  colour1: UnresolvedStyleValue;
  colour2: UnresolvedStyleValue;
  colour3: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksBrackets: BracketsStyleSettings;
  }
}

// VS Code's own defaults for themes without bracket colours. Terminal colours would match syntax colours in
// themes such as Night Owl, so brackets would look like keywords.
const vsCodeDefaults = { dark: ['#ffd700', '#da70d6', '#179fff'], light: ['#0431fa', '#319331', '#7b3814'] };

const bracketColour =
  (depth: number): StyleResolverFn =>
  (context) =>
    onCode(
      context,
      context.theme.colors[`editorBracketHighlight.foreground${depth}`] ??
        vsCodeDefaults[context.theme.type][depth - 1] ??
        context.theme.fg,
      4.5,
    );

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksBrackets: { colour1: bracketColour(1), colour2: bracketColour(2), colour3: bracketColour(3) },
  },
});

export interface BracketMatch {
  line: number;
  column: number;
  /** 0, 1 or 2. The two brackets of a pair always get the same depth. */
  depth: number;
  /** Shared by the two brackets of a pair, so the client module can find the partner on hover. */
  pairId: string;
}

/**
 * Finds matching `()`, `[]` and `{}` pairs in code, skipping brackets in strings and line or block
 * comments. Strings and comments follow common quote and escape rules, not a full language grammar.
 * A bracket with no partner is left out, so it keeps its normal colour.
 */
export function findBrackets(lines: string[], syntaxes: CommentSyntax[], charLiterals = false): BracketMatch[] {
  const matches: BracketMatch[] = [];
  const stack: Array<{ line: number; column: number; close: string; template?: boolean }> = [];
  let blockCommentClose: string | undefined;
  let quote: string | undefined;
  let pairCount = 0;
  lines.forEach((text, line) => {
    let i = 0;
    while (i < text.length) {
      if (blockCommentClose) {
        const end = text.indexOf(blockCommentClose, i);
        if (end === -1) break;
        i = end + blockCommentClose.length;
        blockCommentClose = undefined;
        continue;
      }
      if (quote) {
        if (text[i] === '\\') {
          i += 2;
          continue;
        }
        if (quote === '`' && text.startsWith('${', i)) {
          stack.push({ line, column: i + 1, close: '}', template: true });
          quote = undefined;
          i += 2;
          continue;
        }
        if (text.startsWith(quote, i)) {
          i += quote.length;
          quote = undefined;
          continue;
        }
        i++;
        continue;
      }
      // A shell or YAML `#` starts a comment only at the start of a word, not in `${#arr[@]}` or `$#`.
      const comment = syntaxes.find(
        (syntax) =>
          text.startsWith(syntax.open, i) && (syntax.open !== '#' || i === 0 || /\s/.test(text[i - 1] as string)),
      );
      if (comment) {
        if (!comment.close) break;
        blockCommentClose = comment.close;
        i += comment.open.length;
        continue;
      }
      const char = text[i] as string;
      // An escaped bracket or slash, as in a regex `/\(/` or `/https?:\/\//`, is a literal character.
      if (char === '\\') {
        i += 2;
        continue;
      }
      const triple = char.repeat(3);
      if ((char === '"' || char === "'") && text.startsWith(triple, i)) {
        quote = triple;
        i += 3;
        continue;
      }
      if (char === '"' || char === '`' || (char === "'" && opensSingleQuote(text, i, charLiterals))) {
        quote = char;
      } else if ('([{'.includes(char)) {
        stack.push({ line, column: i, close: ')]}'['([{'.indexOf(char)] as string });
      } else if (')]}'.includes(char) && stack.at(-1)?.close === char) {
        const open = stack.pop() as (typeof stack)[number];
        const depth = stack.length % 3;
        const pairId = `${PREFIX}-brackets-${pairCount++}`;
        matches.push({ line: open.line, column: open.column, depth, pairId }, { line, column: i, depth, pairId });
        if (open.template) quote = '`';
      }
      i++;
    }
    // Single and double-quoted strings do not span lines. Backtick and triple-quoted strings do.
    if (quote === '"' || quote === "'") quote = undefined;
  });
  return matches;
}

// A lifetime (`&'a`), type variable or Lisp quote has no partner, or only a distant one, on the line.
function opensSingleQuote(text: string, i: number, charLiterals: boolean) {
  if (charLiterals) return /^'(?:\\.[^']{0,8}|[^'\\])'/.test(text.slice(i));
  for (let j = i + 1; j < text.length; j += text[j] === '\\' ? 2 : 1) if (text[j] === "'") return true;
  return false;
}

// Languages where `'` starts a char literal or is part of other syntax, never a string.
const charLiteralLanguages = new Set([
  'rust',
  'rs',
  'ocaml',
  'ml',
  'fsharp',
  'f#',
  'fs',
  'haskell',
  'hs',
  'elm',
  'purescript',
  'sml',
  'lisp',
  'common-lisp',
  'scheme',
  'racket',
  'clojure',
  'clj',
  'emacs-lisp',
  'elisp',
]);

class BracketAnnotation extends ExpressiveCodeAnnotation {
  constructor(
    private readonly depth: number,
    private readonly pairId: string,
    inlineRange: { columnStart: number; columnEnd: number },
  ) {
    // Earliest, so text markers and word diff wrap the bracket from outside instead of being unwrapped.
    super({ inlineRange, renderPhase: 'earliest' });
  }
  render({ nodesToTransform }: AnnotationRenderOptions) {
    return nodesToTransform.map((node) =>
      h('span', { class: `${PREFIX}-brackets-${this.depth + 1}`, dataScbPair: this.pairId }, [node]),
    );
  }
}

/** Colours matching brackets by nesting depth. `brackets.languages` turns it on for every block of a language. */
export function pluginBrackets({
  languages = [],
  comments = {},
}: {
  languages?: string[];
  comments?: Record<string, string[]>;
} = {}): CodeblocksPlugin {
  const ids = new Set(languages.map(languageId));
  return {
    name: 'starlight-codeblocks:brackets',
    styleSettings,
    baseStyles: `
.${PREFIX}-brackets-1, .${PREFIX}-brackets-2, .${PREFIX}-brackets-3 { border-radius: 2px; }
.${PREFIX}-brackets-on { outline: 1px solid currentColor; outline-offset: 0; }`,
    jsModules: clientJsModules,
    hooks: {
      annotateCode({ codeBlock, styleVariants }) {
        const on = codeBlock.metaOptions.getBoolean('brackets') ?? ids.has(languageId(codeBlock.language));
        if (!on) return;
        const lines = codeBlock.getLines();
        const matches = findBrackets(
          lines.map((line) => line.text),
          commentSyntaxFor(codeBlock.language, comments),
          charLiteralLanguages.has(codeBlock.language),
        );
        for (const { line, column, depth, pairId } of matches) {
          const inlineRange = { columnStart: column, columnEnd: column + 1 };
          const target = lines[line] as ExpressiveCodeLine;
          target.addAnnotation(new BracketAnnotation(depth, pairId, inlineRange));
          // A syntax colour, not a class colour, so that the contrast passes for line and word tints correct it.
          styleVariants.forEach((variant, styleVariantIndex) => {
            const color = variant.resolvedStyleSettings.get(`codeblocksBrackets.colour${depth + 1}` as never);
            target.addAnnotation(
              new InlineStyleAnnotation({ inlineRange, color, styleVariantIndex, renderPhase: 'earliest' }),
            );
          });
        }
      },
      postprocessRenderedBlock({ renderData }) {
        const pre = select('pre', renderData.blockAst);
        if (pre && select('[data-scb-pair]', pre)) pre.properties.dataScbBrackets = '';
      },
    },
  };
}
