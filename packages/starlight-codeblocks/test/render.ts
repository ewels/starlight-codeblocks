import { select, toHtml } from '@expressive-code/core/hast';
import { ExpressiveCode } from 'expressive-code';
import { pluginCodeblocks } from '../src/expressive-code/index.ts';

const FENCE = /^(`{3,}|~{3,})([^\s`]*)[ \t]*(.*)\n([\s\S]*?)\n?\1[ \t]*$/;

/** Renders one Markdown code block the way a site with the plugin does. */
export async function render(markdown: string) {
  const match = markdown.trim().match(FENCE);
  if (!match) throw new Error(`Not a single fenced code block:\n${markdown}`);
  const [, , language = '', meta = '', code = ''] = match;
  const ec = new ExpressiveCode({ plugins: [pluginCodeblocks()] });
  const { renderedGroupAst } = await ec.render({ code, language, meta });
  const button = select('button[data-code]', renderedGroupAst);
  return {
    html: toHtml(renderedGroupAst),
    copyText: String(button?.properties.dataCode ?? '').replaceAll('\x7F', '\n'),
  };
}
