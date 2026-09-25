import {
  AttachedPluginData,
  type ExpressiveCodeLine,
  PluginStyleSettings,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { addClassName, select } from '@expressive-code/core/hast';
import { type CodeblocksPlugin, resolveRange } from './core.ts';
import { getDirectives } from './notation.ts';
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
          example: 'retries: 2, // [!code focus]',
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
  outline: 3px solid ${cssVar('focusBorder')};
  outline-offset: -3px;
}
.frame:hover .${OUT}, .frame:focus-within .${OUT} {
  opacity: 1;
  filter: none;
}`,
    hooks: {
      preprocessMetadata(context) {
        const { lines } = focusData.getOrCreateFor(context.codeBlock);
        for (const line of resolveRange(context, 'focus') ?? []) lines.add(line);
        for (const directive of getDirectives(context.codeBlock, 'code focus')) {
          for (const line of directive.lines) lines.add(line);
        }
      },
      postprocessRenderedLine({ codeBlock, line, renderData }) {
        const { lines } = focusData.getOrCreateFor(codeBlock);
        if (lines.size > 0 && !lines.has(line)) addClassName(renderData.lineAst, OUT);
      },
      postprocessRenderedBlock({ codeBlock, renderData }) {
        if (focusData.getOrCreateFor(codeBlock).lines.size === 0) return;
        // Not on the pre: Expressive Code's script removes its tabindex when the code does not scroll.
        const code = select('pre > code', renderData.blockAst);
        if (code) code.properties.tabindex = '0';
      },
    },
  };
}
