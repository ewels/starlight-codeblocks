import {
  type AnnotationRenderOptions,
  ExpressiveCodeAnnotation,
  type ExpressiveCodeLine,
  PluginStyleSettings,
  setAlpha,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { h } from '@expressive-code/core/hast';
import type { CodeblocksPlugin } from './core.ts';
import { PREFIX } from './styles.ts';

export interface WordDiffStyleSettings {
  ins: UnresolvedStyleValue;
  del: UnresolvedStyleValue;
  insBackground: UnresolvedStyleValue;
  delBackground: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksWordDiff: WordDiffStyleSettings;
  }
}

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksWordDiff: {
      ins: ['#5fcd78', '#1f7a3d'],
      del: ['#ff6464', '#c62828'],
      // Dark themes have room for a lighter, more translucent tint; light themes need more opacity for 3:1 contrast.
      insBackground: ({ resolveSetting, theme }) =>
        setAlpha(resolveSetting('codeblocksWordDiff.ins'), theme.type === 'dark' ? 0.6 : 0.75),
      delBackground: ({ resolveSetting, theme }) =>
        setAlpha(resolveSetting('codeblocksWordDiff.del'), theme.type === 'dark' ? 0.7 : 0.75),
    },
  },
});

/** Splits a line into word, whitespace and punctuation tokens, for the longest-common-subsequence diff. */
export function splitTokens(text: string): string[] {
  return text.match(/\w+|\s+|[^\w\s]/g) ?? [];
}

/** Marks the tokens of `a` and `b` that are not part of their longest common subsequence. */
function diffMask(a: string[], b: string[]): [keepA: boolean[], keepB: boolean[]] {
  const n = a.length;
  const m = b.length;
  const length: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  const at = (i: number, j: number) => length[i]?.[j] ?? 0;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const row = length[i] as Uint16Array;
      row[j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  const keepA = new Array<boolean>(n).fill(false);
  const keepB = new Array<boolean>(m).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      keepA[i] = keepB[j] = true;
      i++;
      j++;
    } else if (at(i + 1, j) >= at(i, j + 1)) i++;
    else j++;
  }
  return [keepA, keepB];
}

/** Merges the changed tokens into character ranges. Whitespace between two changed tokens is part of the range. */
function changedRanges(tokens: string[], keep: boolean[]): Array<[start: number, end: number]> {
  const changed = tokens.map((token, i) => {
    if (/\S/.test(token)) return !keep[i];
    const before = tokens[i - 1];
    const after = tokens[i + 1];
    return i > 0 && i < tokens.length - 1 && !keep[i - 1] && !keep[i + 1] && !!before && !!after;
  });
  const ranges: Array<[number, number]> = [];
  let pos = 0;
  let start = -1;
  for (const [i, token] of tokens.entries()) {
    if (changed[i]) {
      if (start === -1) start = pos;
    } else if (start !== -1) {
      ranges.push([start, pos]);
      start = -1;
    }
    pos += token.length;
  }
  if (start !== -1) ranges.push([start, pos]);
  return ranges;
}

export interface WordDiffResult {
  a: Array<[start: number, end: number]>;
  b: Array<[start: number, end: number]>;
}

/**
 * Compares a removed line and an added line token by token. Returns the changed ranges of each line,
 * or `null` when the lines are too different (SPEC 6.9: less than `minSimilarity` similar).
 */
export function wordDiff(a: string, b: string, minSimilarity: number): WordDiffResult | null {
  const tokensA = splitTokens(a);
  const tokensB = splitTokens(b);
  const [keepA, keepB] = diffMask(tokensA, tokensB);
  const matched = tokensA.reduce((sum, token, i) => sum + (keepA[i] ? token.length : 0), 0);
  const similarity = a.length + b.length === 0 ? 1 : (2 * matched) / (a.length + b.length);
  if (similarity < minSimilarity) return null;
  return { a: changedRanges(tokensA, keepA), b: changedRanges(tokensB, keepB) };
}

class ChangedTokenAnnotation extends ExpressiveCodeAnnotation {
  constructor(
    private readonly type: 'ins' | 'del',
    inlineRange: { columnStart: number; columnEnd: number },
  ) {
    super({ inlineRange });
  }
  render({ nodesToTransform }: AnnotationRenderOptions) {
    // Not <ins>/<del>: Expressive Code's text markers style those as inline markers.
    const role = this.type === 'ins' ? 'insertion' : 'deletion';
    return nodesToTransform.map((node) => h('span', { class: `${PREFIX}-worddiff-${this.type}`, role }, [node]));
  }
}

/** The kind a text-markers annotation carries. The class itself is not exported by the plugin. */
function markerType(line: ExpressiveCodeLine): 'ins' | 'del' | undefined {
  for (const annotation of line.getAnnotations()) {
    const type = (annotation as { markerType?: string }).markerType;
    if (type === 'ins' || type === 'del') return type;
  }
  return undefined;
}

/** Highlights the words that changed between a removed line and the added line directly below it. */
export function pluginWordDiff({ minSimilarity = 0.4 }: { minSimilarity?: number } = {}): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:word-diff',
    styleSettings,
    baseStyles: ({ cssVar }) => `
.${PREFIX}-worddiff-ins { background: ${cssVar('codeblocksWordDiff.insBackground')}; border-radius: 2px; text-decoration: underline 1px; text-underline-offset: 0.2em; }
.${PREFIX}-worddiff-del { background: ${cssVar('codeblocksWordDiff.delBackground')}; border-radius: 2px; text-decoration: line-through 1px; }`,
    hooks: {
      // Runs after the text-markers plugin has annotated diff-syntax, `ins`/`del` and `[!code ++/--]` lines.
      annotateCode({ codeBlock }) {
        if (codeBlock.metaOptions.getBoolean('wordDiff') === false) return;
        const lines = codeBlock.getLines();
        let i = 0;
        while (i < lines.length) {
          if (markerType(lines[i] as ExpressiveCodeLine) !== 'del') {
            i++;
            continue;
          }
          const dels: ExpressiveCodeLine[] = [];
          while (i < lines.length && markerType(lines[i] as ExpressiveCodeLine) === 'del') {
            dels.push(lines[i] as ExpressiveCodeLine);
            i++;
          }
          const ins: ExpressiveCodeLine[] = [];
          while (i < lines.length && markerType(lines[i] as ExpressiveCodeLine) === 'ins') {
            ins.push(lines[i] as ExpressiveCodeLine);
            i++;
          }
          for (let pair = 0; pair < Math.min(dels.length, ins.length); pair++) {
            const del = dels[pair] as ExpressiveCodeLine;
            const add = ins[pair] as ExpressiveCodeLine;
            const diff = wordDiff(del.text, add.text, minSimilarity);
            if (!diff) continue;
            for (const [start, end] of diff.a) {
              del.addAnnotation(new ChangedTokenAnnotation('del', { columnStart: start, columnEnd: end }));
            }
            for (const [start, end] of diff.b) {
              add.addAnnotation(new ChangedTokenAnnotation('ins', { columnStart: start, columnEnd: end }));
            }
          }
        }
      },
    },
  };
}
