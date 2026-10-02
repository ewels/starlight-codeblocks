import { AttachedPluginData, type ExpressiveCodeBlock } from '@expressive-code/core';
import { h, select } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { addTitleBarControl, type CodeblocksPlugin } from './core.ts';
import { type FileIconSettings, fileIconResolver } from './file-icons.ts';
import { PREFIX } from './styles.ts';

/** The fence line attribute that the `:::code-tabs` directive adds to each variant. */
export const TABS_META = 'scbTabs';

export interface TabsVariant {
  index: number;
  labels: string[];
  control: 'tabs' | 'menu';
}

export const encodeVariant = (variant: TabsVariant) => encodeURIComponent(JSON.stringify(variant));

const MENU = `${PREFIX}-tabs-menu`;
const LIST = `${PREFIX}-tabs-list`;
const TAB = `${PREFIX}-tabs-tab`;

const labelTitle = new AttachedPluginData(() => ({ fromLabel: false }));
const FIELD = `${PREFIX}-tabs-field`;
const CODE_ICON = 'M8 5.5 1.5 12 8 18.5M16 5.5l6.5 6.5-6.5 6.5';

const icon = (className: string, d: string) =>
  h('svg', { class: className, viewBox: '0 0 24 24', ariaHidden: 'true', focusable: 'false' }, [
    h('path', { d, fill: 'none', stroke: 'currentColor', strokeWidth: '2.5' }),
  ]);

function readVariant(codeBlock: ExpressiveCodeBlock | undefined) {
  const raw = codeBlock?.metaOptions.getString(TABS_META);
  return raw ? (JSON.parse(decodeURIComponent(raw)) as TabsVariant) : undefined;
}

/**
 * Gives each block in a `:::code-tabs` directive an editor tab, which the client module turns into a tab for
 * every variant, or the variant menu with the icon of the language. `fileIcons` takes the settings of the
 * `fileIcons` option, for custom icons in the menu.
 */
export function pluginCodeTabs(fileIcons: Partial<FileIconSettings> = {}): CodeblocksPlugin {
  let icons: ReturnType<typeof fileIconResolver> | undefined;
  return {
    name: 'starlight-codeblocks:code-tabs',
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
.${LIST} {
  display: flex;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.${LIST} > [role='tab'] {
  flex: none;
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
}
.${LIST} > .${TAB} {
  display: inline-flex;
  align-items: center;
  margin-block-start: ${cssVar('frames.editorTabsMarginBlockStart')};
  padding: calc(${cssVar('uiPaddingBlock')} + ${cssVar('frames.editorActiveTabIndicatorHeight')}) ${cssVar('uiPaddingInline')};
  border: ${cssVar('borderWidth')} solid transparent;
  border-bottom: none;
  background: none;
  color: ${cssVar('codeblocks.mutedForeground')};
}
.${LIST} > .${TAB}:hover { color: ${cssVar('frames.editorActiveTabForeground')}; }
.${LIST} > [role='tab']:focus-visible {
  outline: 2px solid ${cssVar('codeblocks.focusRing')};
  outline-offset: -2px;
}
@media print { .${LIST} > .${TAB} { display: none; } }
.${FIELD} > svg {
  position: absolute;
  inset-inline-start: 8px;
  width: 14px;
  height: 14px;
  pointer-events: none;
  color: ${cssVar('codeForeground')};
}
.${FIELD} > svg.${PREFIX}-tabs-chevron {
  inset-inline: auto 8px;
  width: 10px;
  height: 10px;
}`,
    jsModules: clientJsModules,
    hooks: {
      preprocessCode({ codeBlock }) {
        const variant = readVariant(codeBlock);
        if (variant?.control !== 'tabs') return;
        // Runs after the frames plugin, so a file name comment has already become the title.
        codeBlock.props.frame = 'code';
        if (codeBlock.props.title === undefined) {
          codeBlock.props.title = variant.labels[variant.index];
          labelTitle.getOrCreateFor(codeBlock).fromLabel = true;
        }
      },
      async postprocessRenderedBlock({ codeBlock, renderData }) {
        const variant = readVariant(codeBlock);
        if (!variant) return;
        if (variant.control === 'tabs') {
          // A label is not a file name, so its tab has an icon only from `icon="…"`.
          const title = select('.header .title', renderData.blockAst);
          if (title && labelTitle.getOrCreateFor(codeBlock).fromLabel && !codeBlock.metaOptions.getString('icon')) {
            title.children = title.children.filter((node) => node.type !== 'element' || node.tagName !== 'svg');
          }
          return;
        }
        icons ??= fileIconResolver(fileIcons);
        const { index, labels } = variant;
        const resolved = await icons;
        const name = resolved.forLanguage(codeBlock.language);
        const svg = name ? resolved.svg(name) : undefined;
        if (svg) {
          svg.properties = {
            class: `${PREFIX}-tabs-icon`,
            ariaHidden: 'true',
            focusable: 'false',
            ...svg.properties,
          };
        }
        addTitleBarControl(
          renderData.blockAst,
          h('span', { class: `${FIELD} ${PREFIX}-no-print ${PREFIX}-needs-js` }, [
            svg ?? icon(`${PREFIX}-tabs-icon`, CODE_ICON),
            h(
              'select',
              { class: `${PREFIX}-btn ${MENU}`, ariaLabel: 'Variant' },
              labels.map((label, i) => h('option', { value: String(i), selected: i === index }, label)),
            ),
            icon(`${PREFIX}-tabs-chevron`, 'm6 9 6 6 6-6'),
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
