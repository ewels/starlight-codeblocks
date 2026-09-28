import {
  type AnnotationRenderOptions,
  ExpressiveCodeAnnotation,
  type ExpressiveCodeBlock,
  type ExpressiveCodeLine,
  MetaOptions,
} from '@expressive-code/core';
import { h } from '@expressive-code/core/hast';
import type { CodeblocksPlugin } from './core.ts';
import { PREFIX } from './styles.ts';

class WhitespaceAnnotation extends ExpressiveCodeAnnotation {
  constructor(
    private readonly tab: boolean,
    inlineRange: { columnStart: number; columnEnd: number },
  ) {
    super({ inlineRange });
  }
  render({ nodesToTransform }: AnnotationRenderOptions) {
    const className = this.tab ? `${PREFIX}-ws-tab` : `${PREFIX}-ws`;
    // The glyph lives in its own aria-hidden element, positioned over the real character, which stays
    // selectable and copyable as written (SPEC 5 and 6.10).
    return nodesToTransform.map((node) => h('span', { class: className }, [h('span', { ariaHidden: 'true' }), node]));
  }
}

export const TRAILING_META = 'scbTrailing';

/**
 * Expressive Code trims the end of every line before any plugin runs. For a `whitespace="all"` block, returns
 * the fence meta with the trailing whitespace of each line added in a hidden attribute, so that the plugin can
 * put it back. Line numbers count from the first line that is not blank, as Expressive Code drops the others.
 */
export function withTrailingWhitespace(code: string, meta: string): string {
  if (new MetaOptions(meta).getString('whitespace') !== 'all') return meta;
  const lines = code.split(/\r?\n/);
  const first = lines.findIndex((line) => line.trim());
  const trailing = Object.fromEntries(
    lines.flatMap((line, i) => {
      const ws = line.match(/[ \t]+$/)?.[0];
      return i >= first && ws ? [[i - first, ws]] : [];
    }),
  );
  if (Object.keys(trailing).length === 0) return meta;
  return `${meta} ${TRAILING_META}="${encodeURIComponent(JSON.stringify(trailing))}"`;
}

/** The lines of each block before comment notation removes any, since line numbers in the meta count those. */
const linesAsWritten = new WeakMap<ExpressiveCodeBlock, readonly ExpressiveCodeLine[]>();

/** Shows leading whitespace, or every space and tab with `whitespace="all"`, as faint glyphs. */
export function pluginWhitespace(): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:whitespace',
    baseStyles: ({ cssVar }) => `
.${PREFIX}-ws, .${PREFIX}-ws-tab { position: relative; }
/* Centres the glyph's line box on the character, which is shorter than the line height. */
.${PREFIX}-ws > [aria-hidden], .${PREFIX}-ws-tab > [aria-hidden] { position: absolute; inset: 0; display: grid; align-content: center; }
.${PREFIX}-ws > [aria-hidden]::before, .${PREFIX}-ws-tab > [aria-hidden]::before {
  text-align: center;
  color: ${cssVar('codeblocks.mutedForeground')};
}
.${PREFIX}-ws > [aria-hidden]::before { content: '\\00b7'; }
.${PREFIX}-ws-tab > [aria-hidden]::before { content: '\\2192'; text-align: start; }`,
    hooks: {
      preprocessMetadata({ codeBlock }) {
        linesAsWritten.set(codeBlock, codeBlock.getLines());
      },
      preprocessCode({ codeBlock }) {
        const raw = codeBlock.metaOptions.getString(TRAILING_META);
        const lines = linesAsWritten.get(codeBlock);
        if (!raw || !lines) return;
        const current = new Set(codeBlock.getLines());
        for (const [index, ws] of Object.entries(JSON.parse(decodeURIComponent(raw)) as Record<string, string>)) {
          const line = lines[Number(index)];
          if (line && current.has(line)) line.editText(line.text.length, line.text.length, ws);
        }
      },
      annotateCode({ codeBlock }) {
        const all = codeBlock.metaOptions.getString('whitespace') === 'all';
        const on = all || codeBlock.metaOptions.getBoolean('whitespace') === true;
        if (!on) return;
        for (const line of codeBlock.getLines()) {
          const end = all ? line.text.length : (line.text.match(/^[ \t]*/)?.[0].length ?? 0);
          for (let column = 0; column < end; column++) {
            const char = line.text[column];
            if (char === ' ' || char === '\t') {
              line.addAnnotation(
                new WhitespaceAnnotation(char === '\t', { columnStart: column, columnEnd: column + 1 }),
              );
            }
          }
        }
      },
    },
  };
}
