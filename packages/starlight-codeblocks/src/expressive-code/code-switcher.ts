import type { ExpressiveCodeBlock } from '@expressive-code/core';
import { h, select } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { addTitleBarControl, type CodeblocksPlugin } from './core.ts';
import { languageIcon } from './language-icons.ts';
import { PREFIX } from './styles.ts';

/** The fence line attribute that the `:::code-switcher` directive adds to each variant. */
export const SWITCHER_META = 'scbSwitcher';

export interface SwitcherVariant {
  index: number;
  labels: string[];
}

export const encodeVariant = (variant: SwitcherVariant) => encodeURIComponent(JSON.stringify(variant));

const MENU = `${PREFIX}-switcher-menu`;
const FIELD = `${PREFIX}-switcher-field`;
const CODE_ICON = 'M8 5.5 1.5 12 8 18.5M16 5.5l6.5 6.5-6.5 6.5';

const icon = (className: string, d: string, stroke: boolean) =>
  h('svg', { class: className, viewBox: '0 0 24 24', ariaHidden: 'true', focusable: 'false' }, [
    h('path', stroke ? { d, fill: 'none', stroke: 'currentColor', strokeWidth: '2.5' } : { d, fill: 'currentColor' }),
  ]);

function readVariant(codeBlock: ExpressiveCodeBlock | undefined) {
  const raw = codeBlock?.metaOptions.getString(SWITCHER_META);
  return raw ? (JSON.parse(decodeURIComponent(raw)) as SwitcherVariant) : undefined;
}

/** Adds the variant menu to the title bar of each block in a `:::code-switcher` directive. */
export function pluginCodeSwitcher(): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:code-switcher',
    baseStyles: ({ cssVar }) => `
.${FIELD} {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.${MENU}, .${MENU}:hover {
  appearance: none;
  font-family: ${cssVar('codeFontFamily')};
  background: ${cssVar('codeBackground')};
  padding-inline: calc(8px + 14px + 6px) calc(8px + 10px + 6px);
}
.${FIELD} > svg {
  position: absolute;
  inset-inline-start: 8px;
  width: 14px;
  height: 14px;
  pointer-events: none;
  color: ${cssVar('codeForeground')};
}
.${FIELD} > svg.${PREFIX}-switcher-chevron {
  inset-inline: auto 8px;
  width: 10px;
  height: 10px;
}`,
    jsModules: clientJsModules,
    hooks: {
      postprocessRenderedBlock({ codeBlock, renderData }) {
        const variant = readVariant(codeBlock);
        if (!variant) return;
        const { index, labels } = variant;
        const figure = select('figure', renderData.blockAst) ?? renderData.blockAst;
        const path = languageIcon(codeBlock.language);
        addTitleBarControl(
          figure,
          h('span', { class: `${FIELD} ${PREFIX}-no-print ${PREFIX}-needs-js` }, [
            icon(`${PREFIX}-switcher-icon`, path ?? CODE_ICON, !path),
            h(
              'select',
              { class: `${PREFIX}-btn ${MENU}`, ariaLabel: 'Variant' },
              labels.map((label, i) => h('option', { value: String(i), selected: i === index }, label)),
            ),
            icon(`${PREFIX}-switcher-chevron`, 'm6 9 6 6 6-6', true),
          ]),
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
