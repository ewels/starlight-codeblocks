import type { ExpressiveCodeTheme, StyleVariant } from '@expressive-code/core';
import { select, toHtml } from '@expressive-code/core/hast';
import { ExpressiveCode } from 'expressive-code';
import type { InlineCode, Nodes, Text } from 'mdast';
import type { MdastVisitorContext } from 'satteri';
import { getRegistry } from '../registry.ts';

export const INLINE_CSS_ID = 'virtual:starlight-codeblocks/inline-code.css';

const CLASS = 'scb-inline';
const TEXT_SUFFIX = /^\{:([\w#+.-]+)\}/;

interface EcOptions {
  themeCssRoot?: string;
  themeCssSelector?:
    | false
    | ((theme: ExpressiveCodeTheme, context: { styleVariants: StyleVariant[] }) => string | false);
  useDarkModeMediaQuery?: boolean;
  useStarlightDarkModeSwitch?: boolean;
  shiki?: object;
}

const siteOptions = () => (getRegistry()?.expressiveCode ?? {}) as EcOptions;

let fallback: ExpressiveCode | undefined;
/** The site engine's style variants, or Expressive Code's default themes outside a site. */
function styleVariants() {
  const variants = getRegistry()?.styleVariants;
  if (variants) return variants;
  fallback ??= new ExpressiveCode();
  return fallback.styleVariants;
}

/** Starlight's own `themeCssSelector`, unless the site sets one. */
function themeSelector({ themeCssSelector, useStarlightDarkModeSwitch }: EcOptions, variants: StyleVariant[]) {
  if (themeCssSelector === false) return () => false;
  if (themeCssSelector) return (theme: ExpressiveCodeTheme) => themeCssSelector(theme, { styleVariants: variants });
  return (theme: ExpressiveCodeTheme) => {
    const base = variants[0]?.theme;
    const alt = variants.find((v) => v.theme.type !== base?.type)?.theme;
    const starlight = useStarlightDarkModeSwitch !== false && variants.length >= 2 && (theme === base || theme === alt);
    return `[data-theme='${starlight ? theme.type : theme.name}']`;
  };
}

/** The same theme switch as Expressive Code's own theme styles, for inline code outside any block. */
export function inlineStyles(variants = styleVariants(), ec = siteOptions()) {
  const root = ec.themeCssRoot ?? ':root';
  const selector = themeSelector(ec, variants);
  const rules = (index: number) => {
    const settings = variants[index]?.resolvedStyleSettings;
    return `code.${CLASS} { background: ${settings?.get('codeBackground')}; color: ${settings?.get('codeForeground')}; }
code.${CLASS} span[style^='--'] {
  color: var(--${index}, inherit);
  background-color: var(--${index}bg, transparent);
  font-style: var(--${index}fs, inherit);
  font-weight: var(--${index}fw, inherit);
  text-decoration: var(--${index}td, inherit);
}`;
  };
  const scoped = (prefix: string, css: string) => css.replace(/^code\./gm, `${prefix} code.`);
  const base = variants[0]?.theme;
  const baseSelector = base && selector(base);
  const notBase = baseSelector ? `:not(${baseSelector})` : '';
  let css = rules(0);
  const altIndex = variants.findIndex((v) => v.theme.type !== base?.type);
  if ((ec.useDarkModeMediaQuery ?? (variants.length === 2 && altIndex === 1)) && altIndex > 0) {
    css += `\n@media (prefers-color-scheme: ${variants[altIndex]?.theme.type}) {\n${scoped(`${root}${notBase}`, rules(altIndex))}\n}`;
  }
  variants.forEach((variant, index) => {
    const own = index > 0 && selector(variant.theme);
    if (own) css += `\n${scoped(`${root}${own}`, rules(index))}`;
  });
  return css;
}

let engine: ExpressiveCode | undefined;
let failed = false;
let queue: Promise<unknown> = Promise.resolve();

/** The token spans for `code`, or `undefined` when Expressive Code does not know the language. */
function highlight(code: string, language: string) {
  engine ??= new ExpressiveCode({
    themes: styleVariants().map((v) => v.theme),
    // The site engine already corrected the contrast of these themes against its own backgrounds.
    minSyntaxHighlightingColorContrast: 0,
    frames: false,
    textMarkers: false,
    useStyleReset: false,
    shiki: siteOptions().shiki,
    logger: { warn: () => (failed = true), error: () => (failed = true) },
  });
  // One render at a time, so that a warning belongs to the render that logged it.
  const result = queue.then(async () => {
    failed = false;
    const { renderedGroupAst } = (await engine?.render({ code, language })) ?? {};
    const line = renderedGroupAst && select('.ec-line .code', renderedGroupAst);
    return failed || !line ? undefined : toHtml(line.children);
  });
  queue = result.catch(() => {});
  return result;
}

/** The `{:lang}` after an inline code node: its language and the nodes, with the text to keep, that it spans. */
function suffix(siblings: readonly Nodes[], index: number) {
  const [first, second, third] = siblings.slice(index + 1, index + 4);
  if (first?.type !== 'text') return;
  const text = first.value.match(TEXT_SUFFIX);
  if (text)
    return {
      lang: text[1] as string,
      remove: [] as Nodes[],
      rest: first,
      restValue: first.value.slice(text[0].length),
    };
  // With directives on, `{:js}` parses as the text `{`, a `js` text directive and text that starts with `}`.
  if (
    first.value === '{' &&
    second?.type === 'textDirective' &&
    second.children.length === 0 &&
    Object.keys(second.attributes ?? {}).length === 0 &&
    third?.type === 'text' &&
    third.value.startsWith('}')
  ) {
    return { lang: second.name, remove: [first, second] as Nodes[], rest: third, restValue: third.value.slice(1) };
  }
}

export async function inlineCode(node: InlineCode, ctx: MdastVisitorContext, warn: (message: string) => void) {
  const parent = ctx.parent(node);
  const index = ctx.indexOf(node);
  if (!parent || index === undefined) return;
  const found = suffix(parent.children as Nodes[], index);
  if (!found) return;
  for (const removed of found.remove) ctx.removeNode(removed);
  if (found.restValue) ctx.setProperty(found.rest as Text, 'value', found.restValue);
  else ctx.removeNode(found.rest);
  const tokens = await highlight(node.value, found.lang);
  if (tokens === undefined) {
    warn(`inline code \`${node.value}\` has the unknown language \`${found.lang}\`. It shows as plain inline code.`);
    return;
  }
  return { type: 'html', value: `<code class="${CLASS}" data-lang="${found.lang}">${tokens}</code>` } as const;
}
