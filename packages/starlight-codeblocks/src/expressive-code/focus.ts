import {
  AttachedPluginData,
  type ExpressiveCodeLine,
  PluginStyleSettings,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { addClassName, select } from '@expressive-code/core/hast';
import type { CodeblocksPlugin } from './core.ts';
import { markedLines } from './notation.ts';
import { PREFIX } from './styles.ts';

export interface FocusStyleSettings {
  blur: UnresolvedStyleValue;
  opacity: UnresolvedStyleValue;
  transitionDuration: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksFocus: FocusStyleSettings;
  }
}

const styleSettings = new PluginStyleSettings({
  defaultValues: { codeblocksFocus: { blur: '1.1px', opacity: '0.48', transitionDuration: '250ms' } },
});

const focusData = new AttachedPluginData<{ lines: Set<ExpressiveCodeLine> }>(() => ({ lines: new Set() }));

const OUT = `${PREFIX}-focus-out`;

/** Blurs the lines outside `focus={…}` and `[!code focus]` until the reader hovers over or tabs into the block. */
export function pluginFocus({ style = 'blur' }: { style?: 'blur' | 'dim' } = {}): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:focus',
    directives: {
      'code focus': {
        placement: 'end',
        docs: {
          description: 'Focuses the line. The other lines are blurred.',
          example: {
            lang: 'js',
            code: "const host = 'localhost'\nconst port = 8080 // [!code focus]\nconst debug = false",
          },
          page: 'features/focus',
        },
      },
    },
    styleSettings,
    baseStyles: ({ cssVar }) => `
.${OUT} {
  opacity: ${cssVar('codeblocksFocus.opacity')};
  ${style === 'blur' ? `filter: blur(${cssVar('codeblocksFocus.blur')});` : ''}
  transition: filter ${cssVar('codeblocksFocus.transitionDuration')} ease, opacity ${cssVar('codeblocksFocus.transitionDuration')} ease;
}
pre > code[tabindex]:focus-visible {
  outline: 3px solid ${cssVar('codeblocks.focusRing')};
  outline-offset: -3px;
}
/* The sticky block of scrollycoding sits under the pointer while the reader scrolls, so hover must not clear it. */
.frame:not(.${PREFIX}-scrolly-frame):hover .${OUT}, .frame:focus-within .${OUT} {
  opacity: 1;
  filter: none;
}
@media print {
  .${OUT} { opacity: 0.6; filter: none; }
}`,
    hooks: {
      preprocessMetadata(context) {
        focusData.getOrCreateFor(context.codeBlock).lines = markedLines(context, 'focus', 'code focus');
      },
      postprocessRenderedLine({ codeBlock, line, renderData }) {
        const { lines } = focusData.getOrCreateFor(codeBlock);
        if (lines.size > 0 && !lines.has(line)) addClassName(renderData.lineAst, OUT);
      },
      postprocessRenderedBlock({ codeBlock, renderData }) {
        if (focusData.getOrCreateFor(codeBlock).lines.size === 0) return;
        // Not on the pre: Expressive Code's script removes its tabindex when the code does not scroll.
        const code = select('pre > code', renderData.blockAst);
        if (!code) return;
        code.properties.tabindex = '0';
        code.properties.ariaLabel = codeBlock.props.title ? `Code: ${codeBlock.props.title}` : 'Code block';
      },
    },
  };
}
