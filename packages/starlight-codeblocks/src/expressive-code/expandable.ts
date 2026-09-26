import { h, select } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import type { CodeblocksPlugin } from './core.ts';
import { PREFIX } from './styles.ts';

/**
 * Caps a long block at `lines`, with a button under the code that shows the rest. Collapsing needs
 * JavaScript (SPEC 6.14 "without JavaScript: the block shows in full"), so the plugin only marks
 * the block; the client module hides the extra lines with `hidden="until-found"` so that find in
 * page can still reach them, and the `scripting` media feature keeps the fade CSS-only until then.
 */
export function pluginExpandable({ lines: siteDefault = 12 }: { lines?: number } = {}): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:expandable',
    baseStyles: ({ cssVar }) => `
.${PREFIX}-expandable-bar {
  display: flex;
  justify-content: center;
  padding: 0.45rem;
  border-top: ${cssVar('borderWidth')} solid ${cssVar('borderColor')};
}
/* The own display rules of lines, markers and callouts otherwise beat the [hidden] user-agent style. */
pre[data-scb-expandable] > code > [hidden] { display: none; }
@media (scripting: none) {
  .${PREFIX}-expandable-bar { display: none; }
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
  pre[data-scb-expandable] > code > .ec-line[hidden] { display: grid !important; }
  pre[data-scb-expandable] > code > .${PREFIX}-callout[hidden] { display: flex !important; }
}`,
    jsModules: clientJsModules,
    hooks: {
      postprocessRenderedBlock({ codeBlock, renderData }) {
        const bare = codeBlock.metaOptions.getBoolean('expandable');
        const n = codeBlock.metaOptions.getInteger('expandable');
        const lines = n ?? (bare ? siteDefault : undefined);
        if (!lines) return;
        const total = codeBlock.getLines().length;
        if (total - lines < 3) return;
        const figure = select('figure', renderData.blockAst);
        const pre = figure && select('pre', figure);
        if (!figure || !pre) return;
        pre.properties.dataScbExpandable = String(lines);
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
