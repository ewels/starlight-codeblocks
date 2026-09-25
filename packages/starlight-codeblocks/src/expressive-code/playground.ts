import { type Element, h, select } from '@expressive-code/core/hast';
import { typescriptPlaygroundUrl } from '../client/shared/typescript-playground.ts';
import { clientJsModules } from '../client-modules.ts';
import type { PlaygroundDefinition } from '../options.ts';
import { addTitleBarControl, type CodeblocksPlugin, warn } from './core.ts';
import { PREFIX } from './styles.ts';

export const builtInPlaygrounds: Record<string, PlaygroundDefinition> = {
  typescript: {
    label: 'Open in TS Playground',
    url: ({ code }) => typescriptPlaygroundUrl(code),
  },
  rust: {
    label: 'Open in Rust Playground',
    url: ({ code }) =>
      `https://play.rust-lang.org/?version=stable&mode=debug&edition=2024&code=${encodeURIComponent(code)}`,
  },
};

const MAX_URL = 8000;

/** The text that the copy button copies, which other features can have changed. */
export function copiedText(blockAst: Element, code: string) {
  const button = select('button[data-code]', blockAst);
  return button ? String(button.properties.dataCode).replaceAll('\x7F', '\n') : code;
}

/** Adds a title bar link or form that opens the copied code in the playground that `playground="<name>"` names. */
export function pluginPlayground(playgrounds: Record<string, PlaygroundDefinition> = {}): CodeblocksPlugin {
  const all = { ...builtInPlaygrounds, ...playgrounds };
  return {
    name: 'starlight-codeblocks:playground',
    baseStyles: `form.${PREFIX}-playground { display: contents; }`,
    jsModules: clientJsModules,
    hooks: {
      postprocessRenderedBlock(context) {
        const { codeBlock, renderData } = context;
        const name = codeBlock.metaOptions.getString('playground');
        if (name === undefined) return;
        const playground = all[name];
        if (!playground) {
          warn(
            context,
            `\`playground="${name}"\` is not a known playground. Known playgrounds: ${Object.keys(all).join(', ')}.`,
          );
          return;
        }
        const input = {
          code: copiedText(renderData.blockAst, codeBlock.code),
          lang: codeBlock.language,
          title: codeBlock.props.title,
        };
        const label = [playground.label, h('span', { class: `${PREFIX}-sr-only` }, ' (opens in a new tab)')];
        let control: Element;
        if (playground.url) {
          const href = playground.url(input);
          if (href.length > MAX_URL) {
            warn(
              context,
              `the "${name}" playground URL is ${href.length} characters long. Some browsers cut URLs longer than ${MAX_URL}.`,
            );
          }
          control = h(
            'a',
            { class: `${PREFIX}-btn ${PREFIX}-playground`, href, target: '_blank', rel: 'noopener' },
            label,
          );
          // Its compressed code cannot take placeholder values by text replacement, so a script rebuilds it.
          if (playground === builtInPlaygrounds.typescript && select(`.${PREFIX}-placeholder`, renderData.blockAst)) {
            control.properties.dataScbPlayground = '';
          }
        } else {
          const { action, fields } = (playground.post as NonNullable<PlaygroundDefinition['post']>)(input);
          control = h('form', { class: `${PREFIX}-playground`, method: 'post', action, target: '_blank' }, [
            ...Object.entries(fields).map(([field, value]) => h('input', { type: 'hidden', name: field, value })),
            h('button', { type: 'submit', class: `${PREFIX}-btn` }, label),
          ]);
        }
        addTitleBarControl(renderData.blockAst, control);
      },
    },
  };
}
