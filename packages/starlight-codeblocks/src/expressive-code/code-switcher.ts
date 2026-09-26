import type { ExpressiveCodeBlock } from '@expressive-code/core';
import { h, select } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { addTitleBarControl, type CodeblocksPlugin } from './core.ts';
import { PREFIX } from './styles.ts';

/** The fence line attribute that the `:::code-switcher` directive adds to each variant. */
export const SWITCHER_META = 'scbSwitcher';

export interface SwitcherVariant {
  index: number;
  labels: string[];
}

export const encodeVariant = (variant: SwitcherVariant) => encodeURIComponent(JSON.stringify(variant));

const MENU = `${PREFIX}-switcher-menu`;

function readVariant(codeBlock: ExpressiveCodeBlock | undefined) {
  const raw = codeBlock?.metaOptions.getString(SWITCHER_META);
  return raw ? (JSON.parse(decodeURIComponent(raw)) as SwitcherVariant) : undefined;
}

/** Adds the variant menu to the title bar of each block in a `:::code-switcher` directive. */
export function pluginCodeSwitcher(): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:code-switcher',
    baseStyles: ({ cssVar }) => `
.${MENU} {
  font-family: ${cssVar('codeFontFamily')};
  background: ${cssVar('codeBackground')};
  padding-inline-end: 4px;
}
@media (scripting: none) {
  .${MENU} { display: none; }
  .frame:not(.has-title):not(.is-terminal):has(.${PREFIX}-tools > .${MENU}:only-child) .header { display: none; }
}`,
    jsModules: clientJsModules,
    hooks: {
      postprocessRenderedBlock({ codeBlock, renderData }) {
        const variant = readVariant(codeBlock);
        if (!variant) return;
        const { index, labels } = variant;
        const figure = select('figure', renderData.blockAst) ?? renderData.blockAst;
        addTitleBarControl(
          figure,
          h(
            'select',
            { class: `${PREFIX}-btn ${MENU} ${PREFIX}-no-print`, ariaLabel: 'Variant' },
            labels.map((label, i) => h('option', { value: String(i), selected: i === index }, label)),
          ),
        );
      },
      postprocessRenderedBlockGroup({ renderedGroupContents, renderData }) {
        const variant = readVariant(renderedGroupContents[0]?.codeBlock);
        // Without JavaScript, readers see the first variant.
        if (variant && variant.index > 0) renderData.groupAst.properties.hidden = true;
      },
    },
  };
}
