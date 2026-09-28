import {
  type AnnotationRenderOptions,
  ExpressiveCodeAnnotation,
  type ExpressiveCodeLine,
  PluginStyleSettings,
  type StyleResolverFn,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { h, select } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { type CommentSyntax, commentSyntaxFor } from './comments.ts';
import type { CodeblocksPlugin } from './core.ts';
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
export function findBrackets(lines: string[], syntaxes: CommentSyntax[]): BracketMatch[] {
  const matches: BracketMatch[] = [];
  const stack: Array<{ line: number; column: number }> = [];
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
        if (text[i] === quote) quote = undefined;
        i++;
        continue;
      }
      const comment = syntaxes.find((syntax) => text.startsWith(syntax.open, i));
      if (comment) {
        if (!comment.close) break;
        blockCommentClose = comment.close;
        i += comment.open.length;
        continue;
      }
      const char = text[i] as string;
      if (char === '"' || char === "'" || char === '`') {
        quote = char;
      } else if ('([{'.includes(char)) {
        stack.push({ line, column: i });
      } else if (')]}'.includes(char)) {
        const open = stack.pop();
        if (open) {
          const depth = stack.length % 3;
          const pairId = `${PREFIX}-brackets-${pairCount++}`;
          matches.push({ ...open, depth, pairId }, { line, column: i, depth, pairId });
        }
      }
      i++;
    }
    // Single and double-quoted strings do not span lines. Backtick template literals do.
    if (quote === '"' || quote === "'") quote = undefined;
  });
  return matches;
}

class BracketAnnotation extends ExpressiveCodeAnnotation {
  constructor(
    private readonly depth: number,
    private readonly pairId: string,
    inlineRange: { columnStart: number; columnEnd: number },
  ) {
    super({ inlineRange });
  }
  render({ nodesToTransform }: AnnotationRenderOptions) {
    // Unwrap the syntax token span: its own theme colour would override the bracket colour.
    return nodesToTransform.map((node) =>
      h(
        'span',
        { class: `${PREFIX}-brackets-${this.depth + 1}`, dataScbPair: this.pairId },
        node.type === 'element' ? node.children : [node],
      ),
    );
  }
}

/** Colours matching brackets by nesting depth. `brackets.languages` turns it on for every block of a language. */
export function pluginBrackets({ languages = [] }: { languages?: string[] } = {}): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:brackets',
    styleSettings,
    baseStyles: ({ cssVar }) => `
.${PREFIX}-brackets-1, .${PREFIX}-brackets-2, .${PREFIX}-brackets-3 { border-radius: 2px; }
.${PREFIX}-brackets-1 { color: ${cssVar('codeblocksBrackets.colour1')}; }
.${PREFIX}-brackets-2 { color: ${cssVar('codeblocksBrackets.colour2')}; }
.${PREFIX}-brackets-3 { color: ${cssVar('codeblocksBrackets.colour3')}; }
.${PREFIX}-brackets-on { outline: 1px solid currentColor; outline-offset: 0; }`,
    jsModules: clientJsModules,
    hooks: {
      annotateCode({ codeBlock }) {
        const on = codeBlock.metaOptions.getBoolean('brackets') === true || languages.includes(codeBlock.language);
        if (!on) return;
        const lines = codeBlock.getLines();
        const matches = findBrackets(
          lines.map((line) => line.text),
          commentSyntaxFor(codeBlock.language),
        );
        for (const match of matches) {
          (lines[match.line] as ExpressiveCodeLine).addAnnotation(
            new BracketAnnotation(match.depth, match.pairId, {
              columnStart: match.column,
              columnEnd: match.column + 1,
            }),
          );
        }
      },
      postprocessRenderedBlock({ renderData }) {
        const pre = select('pre', renderData.blockAst);
        if (pre && select('[data-scb-pair]', pre)) pre.properties.dataScbBrackets = '';
      },
    },
  };
}
