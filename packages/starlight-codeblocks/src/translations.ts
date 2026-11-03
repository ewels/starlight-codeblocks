import { PluginTexts } from '@expressive-code/core';
import { languageAliases, languages } from './languages.ts';
import { getRegistry } from './registry.ts';

/** The prefix of every key in Starlight's UI strings. */
export const KEY_PREFIX = 'starlightCodeblocks.';

/**
 * The English UI texts, by key without `KEY_PREFIX`. `languages.ts` has the other languages, and Starlight sites change
 * any text in `src/content/i18n/<lang>.json`. A text with a count has i18next plural forms, such as `_one` and `_other`.
 */
export const uiStrings = {
  'block.name': 'Code block',
  'block.nameWithTitle': 'Code: {{title}}',
  'lineStates.error': 'Error',
  'lineStates.warning': 'Warning',
  'lineStates.info': 'Note',
  'lineStates.success': 'Success',
  'squiggles.error': 'Error',
  'squiggles.warning': 'Warning',
  'squiggles.info': 'Info',
  'squiggles.errorLine': 'Line {{line}}, error',
  'squiggles.warningLine': 'Line {{line}}, warning',
  'squiggles.infoLine': 'Line {{line}}, info',
  'annotations.marker': 'Annotation {{number}}',
  'annotations.sideNote': 'Note {{number}}, for line {{line}}:',
  'footnotes.badge': 'Footnote {{number}}',
  'footnotes.number': 'Footnote {{number}}, for line {{line}}',
  'hiddenLines.marker_one': '{{count}} hidden line',
  'hiddenLines.marker_other': '{{count}} hidden lines',
  'hiddenLines.show_one': 'Show {{count}} hidden line',
  'hiddenLines.show_other': 'Show {{count}} hidden lines',
  'hiddenLines.hide_one': 'Hide {{count}} line',
  'hiddenLines.hide_other': 'Hide {{count}} lines',
  'expandable.showAll_one': 'Show all {{count}} line',
  'expandable.showAll_other': 'Show all {{count}} lines',
  'expandable.showFewer': 'Show fewer lines',
  'shellCopy.copy': 'Copy commands',
  'shellCopy.copied': 'Copied',
  'swatches.hint': 'Click to copy',
  'swatches.copy': 'Copy colour {{colour}}',
  'swatches.copied': 'Copied',
  'swatches.copiedColour': 'Copied {{colour}}',
  'permalinks.link': 'Link to line {{line}}',
  'codeTabs.variant': 'Variant',
  'codeTabs.plainText': 'Plain text',
  'playgrounds.typescript': 'Open in TS Playground',
  'playgrounds.rust': 'Open in Rust Playground',
  'playgrounds.newTab': '(opens in a new tab)',
  'runnable.run': 'Run code',
  'runnable.again': 'Run again',
  'runnable.output': 'Output',
  'runnable.running': 'Running…',
  'runnable.loading': 'Loading the {{language}} runtime…',
  'runnable.loadFailed': 'The {{language}} runtime did not load.',
  'runnable.noOutput': 'The code ran with no output.',
  'runnable.timeout_one': 'The run stopped after {{count}} second.',
  'runnable.timeout_other': 'The run stopped after {{count}} seconds.',
  'runnable.error': 'Error:',
  'walkthrough.steps': 'Steps',
  'walkthrough.step': 'Step {{step}}',
  'walkthrough.stepWithLabel': 'Step {{step}}: {{label}}',
  'walkthrough.stepCount': 'Step {{step}} of {{total}}',
  'walkthrough.previous': 'Previous',
  'walkthrough.next': 'Next',
  'scrollycoding.codeFromStep': 'Code from this step on:',
};

type Texts = Record<string, string>;
export type UiKey = keyof typeof uiStrings extends infer K ? (K extends `${infer Base}_${string}` ? Base : K) : never;
type Vars = Record<string, string | number>;
export type Say = (key: UiKey, vars?: Vars) => string;

const withPrefix = (texts: Texts) =>
  Object.fromEntries(Object.entries(texts).map(([key, text]) => [KEY_PREFIX + key, text]));

/** The texts of every language with their full keys, under each code of the language, as `injectTranslations()` takes them. */
export const translations: Record<string, Texts> = Object.fromEntries(
  [['en', uiStrings as Texts] as const, ...Object.entries(languages)].flatMap(([code, texts]) =>
    [code, ...(languageAliases[code] ?? [])].map((alias) => [alias, withPrefix(texts)]),
  ),
);

/** Fills in `{{name}}` and picks the plural form for `count`, as Starlight's `t()` (i18next) does. */
export function format(texts: Texts, locale: string, key: string, vars: Vars = {}) {
  const { count } = vars;
  const text =
    typeof count === 'number'
      ? (count === 0 && texts[`${key}_zero`]) ||
        texts[`${key}_${new Intl.PluralRules(locale).select(count)}`] ||
        texts[`${key}_other`] ||
        texts[key]
      : texts[key];
  return (text ?? key).replace(/\{\{-?\s*(\w+)\s*\}\}/g, (match, name) => String(vars[name] ?? match));
}

/** Starlight's translation function, from `useTranslations()` or `Astro.locals.t`. */
interface StarlightT {
  (key: string, options?: Record<string, unknown>): string;
  exists(key: string, options?: Record<string, unknown>): boolean;
  all(): Record<string, unknown> | undefined;
}

/**
 * Each locale's texts for the Expressive Code plugins, as Starlight gives the copy button its texts: the
 * site's texts for the locale, then for the default locale, then English.
 */
export function siteTexts(
  locales: Record<string, { lang?: string }> | undefined,
  useTranslations: (lang?: string) => StarlightT,
) {
  const own = (lang?: string) =>
    Object.fromEntries(
      Object.entries(useTranslations(lang).all() ?? {}).flatMap(([key, text]) =>
        key.startsWith(KEY_PREFIX) && typeof text === 'string' ? [[key.slice(KEY_PREFIX.length), text]] : [],
      ),
    );
  // i18next reads a language's key without a plural form before the plural forms of the fallback language.
  const over = (base: Texts, top: Texts): Texts =>
    Object.fromEntries(
      Object.entries({ ...base, ...top }).filter(
        ([key]) => key in top || !(key.replace(/_(zero|one|two|few|many|other)$/, '') in top),
      ),
    );
  const fallback = over(uiStrings, own());
  const texts = new PluginTexts<Texts>(fallback);
  for (const [dir, { lang = dir }] of Object.entries(locales ?? {})) {
    // Starlight writes the region in capitals, so a `pt-br` locale has its texts under `pt-BR`.
    const tag = lang.replace(/-([a-z]{2})(?=-|$)/i, (region) => region.toUpperCase());
    texts.addLocale(tag, over(fallback, own(tag)));
  }
  return texts;
}

/** The texts of a block in `locale`, its Expressive Code locale. Sites without Starlight get English. */
export function uiTexts(locale: string): Say {
  const texts = getRegistry()?.texts?.get(locale) ?? uiStrings;
  return (key, vars) => format(texts, locale, key, vars);
}

/** The texts for a component, from Starlight's `Astro.locals.t`, or English without Starlight. */
export function componentTexts(t: StarlightT | undefined): Say {
  return (key, vars) =>
    t?.exists(KEY_PREFIX + key, vars)
      ? t(KEY_PREFIX + key, { ...vars, interpolation: { escapeValue: false } })
      : format(uiStrings, 'en', key, vars);
}
