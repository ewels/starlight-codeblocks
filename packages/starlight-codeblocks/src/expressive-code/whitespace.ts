import { type AnnotationRenderOptions, ExpressiveCodeAnnotation } from '@expressive-code/core';
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

/** Shows leading whitespace, or every space and tab with `whitespace="all"`, as faint glyphs. */
export function pluginWhitespace(): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:whitespace',
    baseStyles: ({ cssVar }) => `
.${PREFIX}-ws, .${PREFIX}-ws-tab { position: relative; }
.${PREFIX}-ws-tab { display: inline-block; width: 4ch; }
.${PREFIX}-ws > [aria-hidden], .${PREFIX}-ws-tab > [aria-hidden] { position: absolute; inset: 0; }
.${PREFIX}-ws > [aria-hidden]::before, .${PREFIX}-ws-tab > [aria-hidden]::before {
  display: block;
  text-align: center;
  color: ${cssVar('codeblocks.mutedForeground')};
}
.${PREFIX}-ws > [aria-hidden]::before { content: '\\00b7'; }
.${PREFIX}-ws-tab > [aria-hidden]::before { content: '\\2192'; }`,
    hooks: {
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
