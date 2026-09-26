import { getColorContrast, onBackground, setAlpha } from '@expressive-code/core';
import { type Element, type ElementContent, selectAll } from '@expressive-code/core/hast';
import { ExpressiveCode } from 'expressive-code';
import { expect, test } from 'vitest';
import { pluginCodeblocks } from '../src/expressive-code/index.ts';
import { minTextContrast, themeSets, tinted, toVariants, type Variant, variants } from './contrast.ts';

// The custom state of the docs site, so that its colours are checked too.
const todo = { todo: { label: 'To do', colour: { dark: '#c792ea', light: '#7c3aed' } } };

const code = [
  "import { readFile } from 'node:fs/promises';",
  'export async function load(path = "./config.json", retries = 3) {',
  '  const data = JSON.parse(await readFile(path, "utf8")); // parse it',
  '  return { ...data, retries: retries ?? 0, ok: true, count: 1e3 };',
];

const colourOf = (el: Element, index: number) =>
  String(el.properties.style ?? '').match(new RegExp(`--${index}:(#[0-9a-fA-F]+)`))?.[1];

/** Each text colour in `el` for the variant, from the innermost span that sets it. Plugin controls do not count. */
function textColours(el: Element, index: number, inherited: string): string[] {
  const own = colourOf(el, index) ?? inherited;
  return el.children.flatMap((child: ElementContent) => {
    if (child.type === 'text') return child.value.trim() ? [own] : [];
    if (
      child.type !== 'element' ||
      /\bscb-(state-|footnote|annotation|sr-only)/.test(String(child.properties.className))
    )
      return [];
    return textColours(child, index, own);
  });
}

/** The colour that `el` inherits for the variant from the spans around it. */
function inheritedColour(root: Element, el: Element, index: number, fallback: string): string {
  const walk = (node: Element, colour: string): string | undefined => {
    if (node === el) return colour;
    const own = colourOf(node, index) ?? colour;
    for (const child of node.children) {
      const found = child.type === 'element' ? walk(child, own) : undefined;
      if (found) return found;
    }
    return undefined;
  };
  return walk(root, fallback) ?? fallback;
}

const cases: { name: string; fence: string; lines: string[]; selector: string; layers: (v: Variant) => string[] }[] = [
  ...['error', 'warning', 'info', 'todo'].map((state) => ({
    name: `${state} line`,
    fence: `js ${state}={1-4}`,
    lines: code,
    selector: `.ec-line.scb-state-${state} .code`,
    layers: (v: Variant) => [v.get(`codeblocksLineStates.${state}Background`)],
  })),
  ...(['ins', 'del'] as const).map((type) => ({
    name: `word diff ${type}`,
    fence: 'diff lang="js"',
    lines: code.flatMap((line, n) => {
      let i = n;
      return [`-${line}`, `+${line.replace(/\w+/g, (w) => (i++ % 3 ? w : `${w}X`))}`];
    }),
    selector: `.scb-worddiff-${type}`,
    layers: (v: Variant) => [v.get(`textMarkers.${type}Background`), v.get(`codeblocksWordDiff.${type}Background`)],
  })),
  {
    name: 'footnote line',
    fence: 'js',
    lines: code.flatMap((line) => ['// [!ref] A note.', line]),
    selector: '.ec-line .code',
    layers: (v) => [v.get('codeblocksFootnotes.lineBackground')],
  },
  {
    name: 'annotated line',
    fence: 'js annotations="side"',
    lines: code.map((line) => `${line} // [!annotate] A note.`),
    selector: '.ec-line[data-scb-anno] .code',
    layers: (v) => [setAlpha(v.get('codeblocks.accent'), 0.17)],
  },
  {
    name: 'mention line',
    fence: 'js',
    lines: code.map((line) => `${line} // [!mention load]`),
    selector: '.ec-line[data-scb-mention] .code',
    layers: (v) => [v.get('codeblocksMentions.background')],
  },
];

test('code text meets 4.5:1 contrast on every line and word tint, in the dark and the light theme', async () => {
  for (const themes of await themeSets()) {
    const ec = new ExpressiveCode({ themes, plugins: [pluginCodeblocks({ lineStates: { states: todo } })] });
    await ec.getBaseStyles();
    const all = toVariants(ec);
    expect(new Set(all.map((v) => v.type))).toEqual(new Set(['dark', 'light']));
    for (const { name, fence, lines, selector, layers } of cases) {
      const [language = '', ...meta] = fence.split(' ');
      const { renderedGroupAst } = await ec.render({ code: lines.join('\n'), language, meta: meta.join(' ') });
      const els = selectAll(selector, renderedGroupAst);
      expect(els.length, name).toBeGreaterThan(0);
      all.forEach((v, i) => {
        const bg = tinted(v, layers(v));
        const colours = new Set(
          els.flatMap((el) => textColours(el, i, inheritedColour(renderedGroupAst, el, i, v.get('codeForeground')))),
        );
        for (const c of colours) {
          expect(getColorContrast(c, bg), `${c} on ${name}, ${v.name}`).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  }
});

test('every syntax colour meets 4.5:1 contrast on the tints that any line or token can get', async () => {
  for (const v of await variants()) {
    const layers = {
      'permalink target': [v.get('codeblocksPermalinks.targetBackground')],
      'API link hover': [v.get('codeblocksApiLinks.hoverBackground')],
      'token link hover': [v.get('codeblocksTokenLinks.hoverBackground')],
    };
    for (const [name, tint] of Object.entries(layers)) {
      expect(minTextContrast(v, tint), `${name}, ${v.name}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test('the text of a placeholder field meets 4.5:1 contrast on its own tint', async () => {
  const css = await new ExpressiveCode({ plugins: [pluginCodeblocks()] }).getBaseStyles();
  const placeholderOpacity = Number(css.match(/\.scb-placeholder::placeholder\{[^}]*opacity:([\d.]+)/)?.[1] ?? 1);
  for (const v of await variants()) {
    for (const c of v.text) {
      const bg = onBackground(setAlpha(c, 0.1), v.get('codeBackground'));
      expect(getColorContrast(c, bg), `${c}, ${v.name}`).toBeGreaterThanOrEqual(4.5);
      const hint = onBackground(setAlpha(c, placeholderOpacity), bg);
      expect(getColorContrast(hint, bg), `placeholder ${c}, ${v.name}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test('inline code in the footnote list meets 4.5:1 contrast, also in the sticky list', async () => {
  const css = await new ExpressiveCode({ plugins: [pluginCodeblocks()] }).getBaseStyles();
  expect(css).toMatch(/\.scb-footnotes code\{[^}]*color:var\(--ec-codeFg\)/);
  for (const v of await variants()) {
    const fg = v.get('codeForeground');
    for (const list of [v.get('codeBackground'), tinted(v, [setAlpha(fg, 0.05)])]) {
      expect(getColorContrast(fg, onBackground(setAlpha(fg, 0.12), list)), v.name).toBeGreaterThanOrEqual(4.5);
    }
  }
});
