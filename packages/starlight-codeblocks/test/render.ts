import type { ExpressiveCodePlugin } from '@expressive-code/core';
import { select, toHtml } from '@expressive-code/core/hast';
import { ExpressiveCode } from 'expressive-code';
import { decodeCode } from '../src/client/shared/copy.ts';
import { pluginCodeblocks } from '../src/expressive-code/index.ts';
import type { CodeblocksOptions } from '../src/options.ts';

const FENCE = /^(`{3,}|~{3,})([^\s`]*)[ \t]*(.*)\n([\s\S]*?)\n?\1[ \t]*$/;

/** Renders one Markdown code block the way a site with the plugin does, with `plugins` before it. Warnings go to `warnings`. */
export async function render(markdown: string, options: CodeblocksOptions = {}, plugins: ExpressiveCodePlugin[] = []) {
  const match = markdown.trim().match(FENCE);
  if (!match) throw new Error(`Not a single fenced code block:\n${markdown}`);
  const [, , language = '', meta = '', code = ''] = match;
  const warnings: string[] = [];
  const ec = new ExpressiveCode({
    plugins: [...plugins, pluginCodeblocks(options)],
    logger: { warn: (message) => warnings.push(message) },
  });
  const { renderedGroupAst } = await ec.render({
    code,
    language,
    meta,
    parentDocument: { sourceFilePath: 'src/content/docs/example.md' },
  });
  const button = select('.copy button[data-code]', renderedGroupAst);
  const commands = select('.scb-shell-copy', renderedGroupAst);
  const rawHtml = toHtml(renderedGroupAst);
  return {
    /** The HTML without the decoration marker, which `test/decorations.test.ts` checks. */
    html: rawHtml.replaceAll(' scb-deco', '').replace(/ data-pagefind-ignore(="")?/g, ''),
    rawHtml,
    copyText: decodeCode(String(button?.properties.dataCode ?? '')),
    /** The text of smart shell copy's Copy commands button, if the block has one. */
    commandsText: commands && decodeCode(String(commands.properties.dataCode)),
    warnings,
  };
}

/** The CSS that the plugin adds to every page. */
export const baseStyles = (options: CodeblocksOptions = {}) =>
  new ExpressiveCode({ plugins: [pluginCodeblocks(options)] }).getBaseStyles();

/** The resolved style variants, one per theme. */
export async function styleVariants(options: CodeblocksOptions = {}) {
  const ec = new ExpressiveCode({ plugins: [pluginCodeblocks(options)] });
  await ec.getBaseStyles();
  return ec.styleVariants;
}

/** A fenced code block: the fence line's language and meta, then the code lines. */
export const block = (fence: string, ...lines: string[]) => [`\`\`\`${fence}`, ...lines, '```'].join('\n');

/** The class attribute of each rendered line. */
export const lineClasses = (html: string) => html.match(/<div class="ec-line[^"]*"/g)?.map((m) => m.slice(12, -1));

const decode = (value?: string) =>
  value?.replace(/&#x([0-9A-F]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)));

/** The linked text and the attributes of each API link, in order. */
export function apiLinks(html: string) {
  return [...html.matchAll(/<a class="scb-api-link" ((?:[^>"]|"[^"]*")*)>(.*?)<\/a>/g)].map(
    ([, attributes = '', inner = '']) => {
      const attribute = (name: string) => decode(attributes.match(new RegExp(`${name}="([^"]*)"`))?.[1]);
      return {
        text: inner.replace(/<[^>]+>/g, ''),
        href: attribute('href'),
        head: attribute('data-scb-api-head'),
        summary: attribute('data-scb-api-summary'),
        source: attribute('data-scb-api-source'),
      };
    },
  );
}
