import type { ExpressiveCodeBlock } from '@expressive-code/core';
import { h, type Parents, select, selectAll } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { SWITCHER_META } from './code-switcher.ts';
import type { CodeblocksPlugin } from './core.ts';
import { PREFIX } from './styles.ts';

// A bar under a variant, a Run output panel or a collapsed section would compete with their own controls.
const ownLayout = (codeBlock: ExpressiveCodeBlock) =>
  codeBlock.metaOptions.getString(SWITCHER_META) !== undefined ||
  codeBlock.metaOptions.getBoolean('runnable') === true ||
  ((codeBlock.props as { collapse?: unknown[] }).collapse?.length ?? 0) > 0;

/** Undoes the `auto` option in `<CodeSteps>` and `<Scrollycoding>`, whose steps must show every line. */
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
 * Caps a long block at `lines`, with a button under the code that shows the rest. Collapsing needs
 * JavaScript (SPEC 6.14 "without JavaScript: the block shows in full"), so the plugin only marks
 * the block; the client module hides the extra lines with `hidden="until-found"` so that find in
 * page can still reach them, and the `scripting` media feature keeps the fade CSS-only until then.
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
/* The own display rules of lines, markers and callouts otherwise beat the [hidden] user-agent style. */
pre[data-scb-expandable] > code > [hidden] { display: none; }
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
  pre[data-scb-expandable] > code > .ec-line[hidden] { display: grid !important; }
  pre[data-scb-expandable] > code > .${PREFIX}-callout[hidden] { display: flex !important; }
}`,
    jsModules: clientJsModules,
    hooks: {
      postprocessRenderedBlock({ codeBlock, renderData }) {
        const flag = codeBlock.metaOptions.getBoolean('expandable');
        const n = codeBlock.metaOptions.getInteger('expandable');
        const total = codeBlock.getLines().length;
        const automatic =
          n === undefined && flag === undefined && auto !== false && total > auto && !ownLayout(codeBlock);
        const lines = n ?? (flag || automatic ? siteDefault : undefined);
        if (!lines) return;
        if (total - lines < 3) return;
        const figure = select('figure', renderData.blockAst);
        const pre = figure && select('pre', figure);
        if (!figure || !pre) return;
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
