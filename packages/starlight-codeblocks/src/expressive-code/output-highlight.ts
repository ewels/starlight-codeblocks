import { ensureColorContrastOnBackground, onBackground, type StyleVariant } from '@expressive-code/core';
import {
  type Element,
  type ElementContent,
  getInlineStyles,
  selectAll,
  setInlineStyles,
  visit,
} from '@expressive-code/core/hast';
import { ExpressiveCode } from 'expressive-code';
import { getRegistry } from '../registry.ts';

const PLAIN = new Set(['txt', 'text', 'plain', 'plaintext']);

/** No language, or one that means plain text. */
export const isPlain = (lang: string | undefined): lang is undefined => !lang || PLAIN.has(lang);

interface Engine {
  ec: ExpressiveCode;
  failed: boolean;
  queue: Promise<unknown>;
}

const engines = new WeakMap<StyleVariant[], Engine>();

function engineFor(variants: StyleVariant[]) {
  const engine = engines.get(variants);
  if (engine) return engine;
  const created: Engine = {
    ec: new ExpressiveCode({
      themes: variants.map((v) => v.theme),
      // The site engine already corrected the syntax colours against its code background.
      minSyntaxHighlightingColorContrast: 0,
      frames: false,
      textMarkers: false,
      useStyleReset: false,
      shiki: (getRegistry()?.expressiveCode as { shiki?: object } | undefined)?.shiki,
      logger: { warn: () => (created.failed = true), error: () => (created.failed = true) },
    }),
    failed: false,
    queue: Promise.resolve(),
  };
  engines.set(variants, created);
  return created;
}

/**
 * `code` rendered in the themes of `variants`, for highlighting outside a code block, or `undefined` when Expressive
 * Code does not know the language.
 */
export function renderTokens(code: string, language: string, variants: StyleVariant[]) {
  const engine = engineFor(variants);
  // One render at a time, so that a warning belongs to the render that logged it.
  const result = engine.queue.then(async () => {
    engine.failed = false;
    const { renderedGroupAst } = await engine.ec.render({ code, language });
    return engine.failed ? undefined : renderedGroupAst;
  });
  engine.queue = result.catch(() => {});
  return result;
}

/** Text forms of the escape character, for ANSI output written by hand or on a fence line. */
const ESCAPES = /\\(?:e|x1b|033|u001b)\[/gi;

/** Each token colour, with its alpha blended in, at `min` contrast on its own background or on `backgrounds`. */
function correctColours(root: Element, variants: StyleVariant[], min: number, backgrounds: string[]) {
  const corrected = new Map<string, string>();
  const readable = (fg: string, bg: string) => {
    const key = `${fg}|${bg}`;
    let colour = corrected.get(key);
    if (colour === undefined) {
      colour = ensureColorContrastOnBackground(onBackground(fg, bg), bg, min);
      corrected.set(key, colour);
    }
    return colour;
  };
  visit(root, 'element', (node: Element) => {
    if (!String(node.properties.style ?? '').startsWith('--')) return;
    const vars = getInlineStyles(node);
    variants.forEach((_, i) => {
      const fg = vars.get(`--${i}`);
      const base = backgrounds[i];
      if (!fg || !base) return;
      const bg = vars.get(`--${i}bg`);
      vars.set(`--${i}`, readable(fg, bg ? onBackground(bg, base) : base));
    });
    setInlineStyles(node, vars);
  });
}

/**
 * The token nodes of each line of `code` in `lang`, in the site's themes, readable on `backgrounds` (one for each
 * theme), or `undefined` when Expressive Code does not know the language.
 */
export async function highlightOutput(
  code: string,
  lang: string,
  variants: StyleVariant[],
  min: number,
  backgrounds: string[],
): Promise<ElementContent[][] | undefined> {
  const ast = await renderTokens(lang === 'ansi' ? code.replace(ESCAPES, '\x1b[') : code, lang, variants);
  if (!ast) return undefined;
  // Expressive Code leaves ANSI colours alone, and the output has its own background.
  correctColours(ast, variants, min, backgrounds);
  // EC fills an empty line with a line break, which would double it in the panel's `pre`.
  return selectAll('.ec-line .code', ast).map((line) =>
    line.children.filter((child) => !(child.type === 'text' && child.value === '\n')),
  );
}
