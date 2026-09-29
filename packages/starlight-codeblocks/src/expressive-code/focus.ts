import {
  AttachedPluginData,
  type ExpressiveCodeLine,
  PluginStyleSettings,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { addClassName, select } from '@expressive-code/core/hast';
import { blockSetting, type CodeblocksPlugin } from './core.ts';
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

const focusData = new AttachedPluginData<{ lines: Set<ExpressiveCodeLine>; style: 'blur' | 'dim' }>(() => ({
  lines: new Set(),
  style: 'blur',
}));

const OUT = `${PREFIX}-focus-out`;

/**
 * Blurs the lines outside `focus={…}` and `[!code focus]` until the reader hovers over or tabs into the block.
 * With `stylesOnly`, it adds only the styles, which the steps of `<Scrollycoding>` also use.
 */
export function pluginFocus({
  style = 'blur',
  stylesOnly = false,
}: {
  style?: 'blur' | 'dim';
  stylesOnly?: boolean;
} = {}): CodeblocksPlugin {
  const plugin: CodeblocksPlugin = {
    name: 'starlight-codeblocks:focus',
    directives: {
      'code focus': {
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
  transition: filter ${cssVar('codeblocksFocus.transitionDuration')} ease, opacity ${cssVar('codeblocksFocus.transitionDuration')} ease;
}
/* A block with \`focus.style\` other than the site's carries it on its code. */
${style === 'blur' ? `.${OUT}:not([data-scb-focus-style='dim'] *)` : `[data-scb-focus-style='blur'] .${OUT}`} {
  filter: blur(${cssVar('codeblocksFocus.blur')});
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
.${OUT}:is(.${PREFIX}-mention-on, .${PREFIX}-permalink-target, .${PREFIX}-annotation-lit, .${PREFIX}-footnote-on, .${PREFIX}-footnote-peek) {
  opacity: 1;
  filter: none;
}
@media print {
  /* As specific as the blur rule above, and after it. */
  .frame .${OUT} { opacity: 0.6; filter: none; }
}`,
    hooks: {
      preprocessCode(context) {
        const data = focusData.getOrCreateFor(context.codeBlock);
        data.lines = markedLines(context, 'focus', 'code focus');
        data.style = blockSetting(
          context,
          'focus.style',
          (raw) => (raw === 'blur' || raw === 'dim' ? raw : undefined),
          style,
          '`"blur"` or `"dim"`',
        );
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
        const blockStyle = focusData.getOrCreateFor(codeBlock).style;
        if (blockStyle !== style) code.properties.dataScbFocusStyle = blockStyle;
        // `code` prohibits a name, so it needs a role that takes one.
        code.properties.role = 'region';
        code.properties.ariaLabel = codeBlock.props.title ? `Code: ${codeBlock.props.title}` : 'Code block';
      },
    },
  };
  return stylesOnly ? { ...plugin, directives: {}, hooks: {} } : plugin;
}
