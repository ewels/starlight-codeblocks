import { type ExpressiveCodeLine, PluginStyleSettings, type UnresolvedStyleValue } from '@expressive-code/core';
import { type ElementContent, h, select, selectAll } from '@expressive-code/core/hast';
import type { CodeblocksPlugin } from './core.ts';
import { inlineMarkdown } from './inline-markdown.ts';
import { getDirectives } from './notation.ts';
import { PREFIX } from './styles.ts';

export interface CalloutsStyleSettings {
  background: UnresolvedStyleValue;
  foreground: UnresolvedStyleValue;
  border: UnresolvedStyleValue;
  fontSize: UnresolvedStyleValue;
  radius: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksCallouts: CalloutsStyleSettings;
  }
}

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksCallouts: {
      background: ({ resolveSetting }) => resolveSetting('codeblocks.popoverBackground'),
      foreground: ({ resolveSetting }) => resolveSetting('codeblocks.popoverForeground'),
      border: ({ resolveSetting }) => resolveSetting('codeblocks.popoverBorder'),
      fontSize: '0.925em',
      radius: '5px',
    },
  },
});

// Browsers draw a tab to the next multiple of 8 columns unless the site sets `tab-size`.
const TAB = 8;

function column(text: string, index: number) {
  let col = 0;
  for (const c of text.slice(0, index)) col = c === '\t' ? (Math.floor(col / TAB) + 1) * TAB : col + 1;
  return col;
}

/** The column, in characters, of the middle of `match` on the line, or of its first character that is not whitespace. */
export function calloutMiddle(text: string, match?: string) {
  const at = match ? text.indexOf(match) : -1;
  if (at >= 0) return column(text, at) + column(match as string, (match as string).length) / 2;
  return column(text, Math.max(0, text.search(/\S/))) + 0.5;
}

const cls = (suffix = '') => `${PREFIX}-callout${suffix}`;

/** Shows the text of `[!callout /text/]` in a bubble above the next line, pointing at `text`. */
export function pluginCallouts(): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:callouts',
    directives: {
      callout: {
        placement: 'own',
        text: true,
        docs: {
          description: 'Shows the text in a bubble above the next line, pointing at `/text/` on that line.',
          args: 'Optional. `/text/` to point at. Then the text of the bubble.',
          example: { lang: 'js', code: '// [!callout /signal/] Stops the request.\nfetch(url, { signal })' },
          page: 'features/inline-callouts',
        },
      },
    },
    styleSettings,
    baseStyles: ({ cssVar }) => {
      const x = `(var(--scb-gutter, 0px) + ${cssVar('codePaddingInline')} + var(--scb-callout-mid) * 1ch)`;
      return `
pre:has(> code > .${cls()}) { container-type: inline-size; }
.${cls()} {
  position: relative;
  box-sizing: border-box;
  display: flex;
  max-width: 100cqi;
  /* On a narrow block, a token past the right edge still gets a readable bubble inside the block. */
  padding: 8px 8px 10px max(8px, min(calc(${x} - 40px), calc(100cqi - 8px - 24ch)));
  white-space: normal;
  user-select: none;
  -webkit-user-select: none;
}
.${cls()}::after {
  content: '';
  position: absolute;
  left: calc(min(${x}, 100cqi - 24px) - 4.5px);
  bottom: 5.5px;
  width: 9px;
  height: 9px;
  box-sizing: border-box;
  background: ${cssVar('codeblocksCallouts.background')};
  border-right: 1px solid ${cssVar('codeblocksCallouts.border')};
  border-bottom: 1px solid ${cssVar('codeblocksCallouts.border')};
  transform: rotate(45deg);
}
.${cls('-bubble')} {
  display: block;
  max-width: min(60ch, 90cqi);
  padding: 4px 10px;
  background: ${cssVar('codeblocksCallouts.background')};
  color: ${cssVar('codeblocksCallouts.foreground')};
  border: 1px solid ${cssVar('codeblocksCallouts.border')};
  border-radius: ${cssVar('codeblocksCallouts.radius')};
  font-size: ${cssVar('codeblocksCallouts.fontSize')};
  line-height: 1.5;
}
.${cls('-bubble')} code {
  padding: 0 4px;
  border-radius: 3px;
  background: color-mix(in srgb, currentColor 12%, transparent);
  font-size: 0.95em;
}
.${cls('-bubble')} a { color: inherit; text-underline-offset: 3px; }
/* A callout on a hidden line shows with the line. */
.${cls('-hidden')}:not(.${PREFIX}-hidden-open) { display: none; }
@media print {
  .${cls('-hidden')} { display: none !important; }
}`;
    },
    hooks: {
      postprocessRenderedBlock({ codeBlock, renderData }) {
        const callouts = getDirectives(codeBlock, 'callout');
        const code = select('pre > code', renderData.blockAst);
        if (callouts.length === 0 || !code) return;
        const lines = codeBlock.getLines();
        const lineEls = selectAll('.ec-line', code);
        for (const directive of callouts) {
          const line = directive.lines[0] as ExpressiveCodeLine;
          const lineEl = lineEls[lines.indexOf(line)];
          if (!lineEl) continue;
          const hidden = (lineEl.properties.className as string[] | undefined)?.includes(`${PREFIX}-hidden-line`);
          const bubble: ElementContent = h(
            'div',
            {
              class: hidden ? `${cls()} ${cls('-hidden')}` : cls(),
              role: 'note',
              style: `--scb-callout-mid:${calloutMiddle(line.text, directive.match)}`,
            },
            [h('span', { class: cls('-bubble') }, inlineMarkdown(directive.text ?? ''))],
          );
          // Callouts for one line keep their source order, directly above it.
          const at = code.children.indexOf(lineEl);
          code.children.splice(at, 0, bubble);
        }
      },
    },
  };
}
