import type { ExpressiveCodePlugin } from '@expressive-code/core';
import { select, toHtml } from '@expressive-code/core/hast';
import { ExpressiveCode } from 'expressive-code';
import { pluginCodeblocks } from '../src/expressive-code/index.ts';
import type { CodeblocksOptions } from '../src/options.ts';

const FENCE = /^(`{3,}|~{3,})([^\s`]*)[ \t]*(.*)\n([\s\S]*?)\n?\1[ \t]*$/;

/** Renders one Markdown code block the way a site with the plugin does. Warnings go to `warnings`. */
export async function render(markdown: string, options: CodeblocksOptions = {}, plugins: ExpressiveCodePlugin[] = []) {
  const match = markdown.trim().match(FENCE);
  if (!match) throw new Error(`Not a single fenced code block:\n${markdown}`);
  const [, , language = '', meta = '', code = ''] = match;
  const warnings: string[] = [];
  const ec = new ExpressiveCode({
    plugins: [pluginCodeblocks(options), ...plugins],
    logger: { warn: (message) => warnings.push(message) },
  });
  const { renderedGroupAst } = await ec.render({
    code,
    language,
    meta,
    parentDocument: { sourceFilePath: 'src/content/docs/example.md' },
  });
  const button = select('button[data-code]', renderedGroupAst);
  const rawHtml = toHtml(renderedGroupAst);
  return {
    /** The HTML without the decoration marker, which `test/decorations.test.ts` checks. */
    html: rawHtml.replaceAll(' scb-deco', '').replace(/ data-pagefind-ignore(="")?/g, ''),
    rawHtml,
    copyText: String(button?.properties.dataCode ?? '').replaceAll('\x7F', '\n'),
    warnings,
  };
}
