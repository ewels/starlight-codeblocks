import type { ExpressiveCodeBlock } from '@expressive-code/core';
import { h, type Parents, select, selectAll } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { TABS_META } from './code-tabs.ts';
import { blockSetting, type CodeblocksPlugin } from './core.ts';
import { PREFIX } from './styles.ts';

const hasCollapse = (codeBlock: ExpressiveCodeBlock) =>
  ((codeBlock.props as { collapse?: unknown[] }).collapse?.length ?? 0) > 0;

// A bar under a variant or a Run output panel would compete with their own controls.
const ownLayout = (codeBlock: ExpressiveCodeBlock) =>
  codeBlock.metaOptions.getString(TABS_META) !== undefined || codeBlock.metaOptions.getBoolean('runnable') === true;

/** Undoes the `auto` option in `<CodeWalkthrough>` and `<Scrollycoding>`, whose steps must show every line. */
export function removeAutoExpandable(root: Parents) {
  for (const figure of selectAll('figure', root)) {
    const pre = select('pre[data-scb-expandable-auto]', figure);
    if (!pre) continue;
    delete pre.properties.dataScbExpandable;
    delete pre.properties.dataScbExpandableAuto;
    figure.children = figure.children.filter(
      (child) => child.type !== 'element' || !String(child.properties.className).includes(`${PREFIX}-expandable-bar`),
    );
  }
}

/**
 * Caps a long block at `lines`, with a button under the code that shows the rest. Without JavaScript the
 * block shows in full, so the plugin only marks it; the client module hides the extra lines with
 * `hidden="until-found"`, which find in page can still reach.
 */
export function pluginExpandable({
  lines: siteDefault = 12,
  auto = false,
}: {
  lines?: number;
  auto?: number | false;
} = {}): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:expandable',
    baseStyles: ({ cssVar }) => `
.${PREFIX}-expandable-bar {
  display: flex;
  justify-content: center;
  padding: 0.45rem;
  border: ${cssVar('borderWidth')} solid ${cssVar('borderColor')};
  border-top: 0;
  border-radius: 0 0 calc(${cssVar('borderRadius')} + ${cssVar('borderWidth')}) calc(${cssVar('borderRadius')} + ${cssVar('borderWidth')});
  background: ${cssVar('codeBackground')};
}
/* Expressive Code's all: revert drops the browser's until-found style. display: none would stop find in page. */
@media not print {
  pre[data-scb-expandable] > code > [hidden='until-found'] { content-visibility: hidden; padding-block: 0; margin-block: 0; }
  pre[data-scb-expandable] > code > [hidden]:not([hidden='until-found']) { display: none; }
}
@media (scripting: none) {
  .${PREFIX}-expandable-bar { display: none; }
}
@media screen and (scripting: enabled) {
  .frame:has(> .${PREFIX}-expandable-bar) > pre { border-end-start-radius: 0; border-end-end-radius: 0; }
  pre.${PREFIX}-expandable-collapsed > code { padding-bottom: 0; }
}
@media (scripting: enabled) {
  pre.${PREFIX}-expandable-collapsed { position: relative; }
  pre.${PREFIX}-expandable-collapsed::after {
    content: '';
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    height: 3.6em;
    background: linear-gradient(transparent, ${cssVar('codeBackground')});
    pointer-events: none;
  }
}
@media print {
  pre.${PREFIX}-expandable-collapsed::after { display: none; }
  pre[data-scb-expandable] > code > .ec-line[hidden]:not(.${PREFIX}-no-print) { display: grid !important; }
  pre[data-scb-expandable] > code > .${PREFIX}-callout[hidden]:not(.${PREFIX}-no-print) { display: flex !important; }
}`,
    jsModules: clientJsModules,
    hooks: {
      postprocessRenderedBlock(context) {
        const { codeBlock, renderData } = context;
        const flag = codeBlock.metaOptions.getBoolean('expandable');
        const n = codeBlock.metaOptions.getInteger('expandable');
        // The client cuts at the Nth .ec-line, which cannot reach past a collapsible section's <details>.
        if (hasCollapse(codeBlock)) return;
        const figure = select('figure', renderData.blockAst);
        const pre = figure && select('pre', figure);
        if (!figure || !pre) return;
        const total = codeBlock.getLines().length - selectAll(`.${PREFIX}-hidden-line`, pre).length;
        const automatic =
          n === undefined && flag === undefined && auto !== false && total > auto && !ownLayout(codeBlock);
        const blockDefault = blockSetting(
          context,
          'expandable.lines',
          (raw) => (/^[1-9]\d*$/.test(raw) ? Number(raw) : undefined),
          siteDefault,
          'a whole number of 1 or more',
        );
        const lines = n ?? (flag || automatic ? blockDefault : undefined);
        if (!lines || total - lines < 3) return;
        pre.properties.dataScbExpandable = String(lines);
        if (automatic) pre.properties.dataScbExpandableAuto = '';
        const bar = h('div', { class: `${PREFIX}-expandable-bar ${PREFIX}-no-print` }, [
          h(
            'button',
            { type: 'button', class: `${PREFIX}-btn ${PREFIX}-expandable-toggle`, ariaExpanded: 'false' },
            `Show all ${total} lines`,
          ),
        ]);
        figure.children.splice(figure.children.indexOf(pre) + 1, 0, bar);
      },
    },
  };
}
