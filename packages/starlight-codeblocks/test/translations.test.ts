import { markdownToHtml } from 'satteri';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { codeWalkthrough } from '../src/components/steps.ts';
import codeblocks from '../src/index.ts';
import { resolveOptions } from '../src/options.ts';
import { setRegistry } from '../src/registry.ts';
import { mdastPlugins } from '../src/satteri/index.ts';
import { componentTexts, format, KEY_PREFIX, siteTexts, translations, uiStrings } from '../src/translations.ts';
import { block, render } from './render.ts';

const key = (name: string) => KEY_PREFIX + name;

/** What a site writes in `src/content/i18n/en.json` and `de.json`, and Starlight's own strings. */
const bundles: Record<string, Record<string, unknown>> = {
  en: { 'search.label': 'Search', [key('runnable.output')]: 'Result' },
  de: {
    'search.label': 'Suchen',
    [key('runnable.run')]: 'Code ausführen',
    [key('runnable.running')]: 'Läuft…',
    [key('runnable.error')]: 'Fehler:',
    [key('runnable.timeout_one')]: 'Nach {{count}} Sekunde gestoppt.',
    [key('runnable.timeout_other')]: 'Nach {{count}} Sekunden gestoppt.',
    [key('hiddenLines.marker_one')]: '{{count}} verborgene Zeile',
    [key('hiddenLines.marker_other')]: '{{count}} verborgene Zeilen',
    [key('hiddenLines.show_other')]: '{{count}} verborgene Zeilen zeigen',
    [key('hiddenLines.hide_other')]: '{{count}} Zeilen verbergen',
    [key('expandable.showAll_other')]: 'Alle {{count}} Zeilen zeigen',
    [key('expandable.showFewer')]: 'Weniger Zeilen zeigen',
    [key('shellCopy.copy')]: 'Befehle kopieren',
    [key('shellCopy.copied')]: 'Kopiert',
    [key('lineStates.error')]: 'Fehler',
    [key('block.nameWithTitle')]: 'Code: {{title}} (de)',
    [key('permalinks.link')]: 'Link zu Zeile {{line}}',
    [key('annotations.marker')]: 'Anmerkung {{number}}',
    [key('footnotes.badge')]: 'Fußnote {{number}}',
    [key('squiggles.error')]: 'Fehler',
    [key('squiggles.errorLine')]: 'Zeile {{line}}, Fehler',
    [key('codeTabs.variant')]: 'Variante',
    [key('codeTabs.plainText')]: 'Klartext',
    [key('playgrounds.typescript')]: 'Im TS Playground öffnen',
    [key('playgrounds.newTab')]: '(öffnet einen neuen Tab)',
    [key('swatches.copy')]: 'Farbe {{ colour }} kopieren',
    [key('walkthrough.stepCount')]: 'Schritt {{step}} von {{total}}',
    [key('walkthrough.stepWithLabel')]: 'Schritt {{step}}: {{label}}',
    [key('walkthrough.next')]: 'Weiter',
  },
};

/** Starlight's `useTranslations()`, with i18next's lookup: the language, then the default locale. */
const useTranslations = (lang = 'en') => {
  const own = { ...translations.en, ...bundles.en, ...bundles[lang] } as Record<string, string>;
  const pick = (k: string, options: { count?: number } = {}) =>
    typeof options.count === 'number'
      ? (own[`${k}_${new Intl.PluralRules(lang).select(options.count)}`] ?? own[k])
      : own[k];
  const t = (k: string, options: Record<string, unknown> = {}) => format(own, lang, k, options as never);
  return Object.assign(t, { all: () => bundles[lang], exists: (k: string, o?: { count?: number }) => !!pick(k, o) });
};

beforeEach(() => {
  setRegistry({
    options: resolveOptions(),
    plugins: [],
    texts: siteTexts({ root: { lang: 'en' }, de: {} }, useTranslations),
    pageLang: (path) => (path.includes('/docs/de/') ? 'de' : 'en'),
  });
});
afterEach(() => setRegistry(undefined));

/** The JSON of the `name` attribute of the first element whose HTML starts with `before`. */
function texts(html: string, before: string, name = 'data-scb-texts') {
  const value = html.match(new RegExp(`${before}[^>]*?${name}="([^"]*)"`))?.[1] ?? '';
  return JSON.parse(value.replaceAll('&#x22;', '"').replaceAll('&quot;', '"'));
}

test('the plugin injects the texts of every language under one prefix, with plural forms', async () => {
  const all: Record<string, Record<string, string>>[] = [];
  await codeblocks().hooks['i18n:setup']?.({ injectTranslations: (t) => all.push(t) });
  const injected = all[0] ?? {};
  expect(Object.keys(injected).sort()).toEqual(
    'ca de en eo es fr hi id it ja ko nb no pl pt pt-BR pt-PT ru sv tr zh zh-CN zh-TW'.split(' '),
  );
  expect(injected['pt-BR']?.[key('runnable.run')]).toBe('Executar código');
  expect(injected.no).toEqual(injected.nb);
  expect(injected.en?.[key('runnable.run')]).toBe('Run code');
  expect(injected.en?.[key('hiddenLines.marker_one')]).toBe('{{count}} hidden line');
  expect(Object.keys(injected.en ?? {}).every((k) => k.startsWith(KEY_PREFIX))).toBe(true);
  expect(Object.keys(injected.en ?? {})).toHaveLength(Object.keys(uiStrings).length);
});

test('format fills in values and picks the plural form of the locale, as i18next does', () => {
  const t = { a_zero: 'none', a_one: '{{count}} line', a_few: '{{count}} linie', a_other: '{{count}} lines' };
  expect(format(t, 'en', 'a', { count: 1 })).toBe('1 line');
  expect(format(t, 'en', 'a', { count: 2 })).toBe('2 lines');
  expect(format(t, 'en', 'a', { count: 0 })).toBe('none');
  expect(format(t, 'pl', 'a', { count: 3 })).toBe('3 linie');
  expect(format(t, 'pl', 'a', { count: 5 })).toBe('5 lines');
  expect(
    format({ b: 'Step {{ step }} of {{total}}, {{-x}} {{missing}}' }, 'en', 'b', { step: 1, total: 2, x: '<y>' }),
  ).toBe('Step 1 of 2, <y> {{missing}}');
});

test('a key without plural forms in a language wins over the plural forms of the fallback, as in i18next', () => {
  const site = siteTexts({ root: { lang: 'en' }, de: {} }, (lang) =>
    Object.assign(() => '', {
      all: () => (lang === 'de' ? { [key('expandable.showAll')]: 'Alle {{count}} Zeilen' } : {}),
      exists: () => false,
    }),
  );
  expect(format(site.get('de'), 'de', 'expandable.showAll', { count: 1 })).toBe('Alle 1 Zeilen');
  expect(format(site.get('de'), 'de', 'hiddenLines.marker', { count: 1 })).toBe('1 hidden line');
  expect(format(site.get('en'), 'en', 'expandable.showAll', { count: 8 })).toBe('Show all 8 lines');
});

test('a locale named by its folder, such as pt-br, finds its texts under the code that Starlight gives it', () => {
  const site = siteTexts({ root: { lang: 'en' }, 'pt-br': {} }, (lang) =>
    Object.assign(() => '', { all: () => (lang === 'pt-BR' ? translations['pt-BR'] : {}), exists: () => false }),
  );
  expect(format(site.get('pt-BR'), 'pt-BR', 'runnable.run')).toBe('Executar código');
});

test('blocks in a locale get its texts, then the default locale, then English', async () => {
  const de = (markdown: string, options = {}) => render(markdown, options, [], 'de');
  const hidden = (await de(block('js hidden={2-3} title="app.js"', 'a', 'b', 'c', 'd'))).html;
  expect(hidden).toContain('<span>2 verborgene Zeilen</span>');
  expect(texts(hidden, 'class="scb-hidden-marker')).toEqual({
    closed: '2 verborgene Zeilen',
    open: '2 Zeilen verbergen',
  });
  expect(texts(hidden, 'class="scb-btn scb-hidden-toggle')).toEqual({
    closed: '2 verborgene Zeilen zeigen',
    open: '2 Zeilen verbergen',
  });
  // The German texts have no `_one` forms, so one line takes the English text.
  const one = (await de(block('js hidden={2}', 'a', 'b', 'c'))).html;
  expect(texts(one, 'class="scb-btn scb-hidden-toggle')).toEqual({ closed: 'Show 1 hidden line', open: 'Hide 1 line' });

  const long = (await de(block('js expandable={2}', ...'abcdefgh'))).html;
  expect(texts(long, 'scb-expandable-toggle')).toEqual({
    closed: 'Alle 8 Zeilen zeigen',
    open: 'Weniger Zeilen zeigen',
  });

  const shell = (await de(block('sh', '$ npm install'))).html;
  expect(shell).toContain('>Befehle kopieren</button>');
  expect(texts(shell, 'scb-shell-copy')).toEqual({ copy: 'Befehle kopieren', copied: 'Kopiert' });

  const states = (await de(block('js title="app.js" focus={1} id="cfg"', 'a // [!code error] Kaputt'))).html;
  expect(states).toContain('<strong aria-hidden="true">Fehler</strong>');
  expect(states).toContain('Fehler:</span>');
  expect(states).toContain('aria-label="Code: app.js (de)"');
  expect(states).toContain('aria-label="Link zu Zeile 1"');

  const notes = (await de(block('js', 'a // [!annotate] Eins', 'b // [!ref] Zwei', 'c // [!error /c/] Weg'))).html;
  expect(notes).toContain('aria-label="Anmerkung 1"');
  expect(notes).toContain('aria-label="Fußnote 1"');
  expect(notes).toContain('aria-label="Footnote 1, for line 2"');
  expect(notes).toContain('<span class="scb-squiggle-label">Fehler</span>');
  expect(notes).toContain('<li>Zeile 3, Fehler: Weg</li>');

  const swatch = (await de(block('css', 'a { color: #fff; }'))).html;
  expect(texts(swatch, '<pre', 'data-scb-swatches')).toEqual({
    hint: 'Click to copy',
    copied: 'Copied',
    copy: 'Farbe {{colour}} kopieren',
    done: 'Copied {{colour}}',
  });

  const play = (await de(block('ts playground="typescript"', 'let x = 1'))).html;
  expect(play).toContain('Im TS Playground öffnen<span class="scb-sr-only"> (öffnet einen neuen Tab)</span>');
});

test('the Run button and the output panel take the texts, but the site and fence labels win', async () => {
  const js = { runnable: { runtimes: { javascript: '/js.js' } } };
  const { html } = await render(block('js runnable runnable.timeout=1000', 'x'), js, [], 'de');
  expect(html).toContain('data-scb-run-again="Run again">Code ausführen</button>');
  expect(texts(html, 'class="scb-run-output"')).toEqual({
    output: 'Result',
    running: 'Läuft…',
    error: 'Fehler: ',
    loading: 'Loading the JavaScript runtime…',
    failed: 'The JavaScript runtime did not load.',
    empty: 'The code ran with no output.',
    timeout: 'Nach 1 Sekunde gestoppt.',
  });
  const site = { runnable: { ...js.runnable, label: 'Try it', againLabel: 'Again' } };
  expect((await render(block('js runnable', 'x'), site, [], 'de')).html).toContain(
    'data-scb-run-again="Again">Try it</button>',
  );
  expect((await render(block('js runnable runnable.label="Los"', 'x'), site, [], 'de')).html).toContain(
    '>Los</button>',
  );
  const scripted = (await render(block('sh runnable.output="ok"', 'x'), {}, [], 'de')).html;
  expect(texts(scripted, 'class="scb-run-output"')).toEqual({ output: 'Result', running: 'Läuft…', error: 'Fehler: ' });
});

test('scripted standard error and the marks on output lines take the texts of the block locale', async () => {
  const output = (options = {}) =>
    render(
      block('sh', 'make', '# [!output]', 'Done # [!code success]', '# [!output stderr]', 'No rule # [!code error]'),
      options,
      [],
      'de',
    );
  const { html } = await output();
  expect(html).toContain('data-scb-runnable-streams="{&#x22;1&#x22;:&#x22;stderr&#x22;}"');
  expect(texts(html, 'class="scb-run-output"').error).toBe('Fehler: ');
  const marks = html.match(/<div class="scb-run-marks" hidden>(.*?)<\/div>/)?.[1] ?? '';
  expect(marks).toContain('<span class="scb-state-prefix scb-sr-only">Fehler:</span>No rule');
  expect(marks).toContain('<strong aria-hidden="true">Fehler</strong>');
  expect(marks).toContain('<strong aria-hidden="true">Success</strong>');
  const own = await output({
    lineStates: { states: { error: { label: 'Kaputt', colour: { dark: '#f66', light: '#c00' } } } },
  });
  expect(own.html).toContain('<span class="scb-state-prefix scb-sr-only">Kaputt:</span>No rule');
});

test('without Starlight, blocks and components get the English texts', async () => {
  setRegistry(undefined);
  const { html } = await render(
    block('js hidden={2} runnable', 'a', 'b'),
    { runnable: { runtimes: { javascript: '/js.js' } } },
    [],
    'de',
  );
  expect(html).toContain('<span>1 hidden line</span>');
  expect(html).toContain('>Run code</button>');
  expect(texts(html, 'class="scb-run-output"').output).toBe('Output');
  const say = componentTexts(undefined);
  expect(say('walkthrough.stepCount', { step: 1, total: 3 })).toBe('Step 1 of 3');
  expect(say('hiddenLines.marker', { count: 2 })).toBe('2 hidden lines');
});

test('components read the texts with Astro.locals.t, and fall back to English for a missing key', async () => {
  const t = useTranslations('de');
  const steps = await Promise.all(
    ['step="Erstellen"', ''].map(
      async (meta) => (await render(block(`js title="a.js" ${meta}`, 'x'), {}, [], 'de')).rawHtml,
    ),
  );
  const html = codeWalkthrough(steps.join('\n'), 1, undefined, componentTexts(t as never));
  expect(html).toContain('<span class="scb-steps-count">Schritt 1 von 2</span>');
  expect(html).toContain('aria-label="Schritt 1: Erstellen"');
  expect(html).toContain('aria-label="Step 2"');
  expect(html).toContain('<span class="scb-steps-nav-text">Weiter</span>');
  expect(html).toContain('aria-label="Previous"');
});

test('code tabs and prose swatches take the language of their page', async () => {
  const page = async (path: string) =>
    (
      await markdownToHtml(
        [':::code-tabs', '```', 'x', '```', '```js', 'y', '```', ':::', '', 'Use #ff0000.'].join('\n'),
        {
          mdastPlugins: mdastPlugins(resolveOptions({ swatches: { prose: true } }), { warn() {} }),
          features: { directive: true },
          fileURL: new URL(`file:///site/src/content/docs/${path}`),
        },
      )
    ).html;
  const de = await page('de/guide.md');
  expect(de).toContain('data-scb-labels="[&quot;Klartext&quot;,&quot;JavaScript&quot;]"');
  expect(de).toContain('data-scb-texts="{&quot;variant&quot;:&quot;Variante&quot;}"');
  expect(de).toContain('Farbe {{colour}} kopieren');
  const en = await page('guide.md');
  expect(en).toContain('data-scb-labels="[&quot;Plain text&quot;,&quot;JavaScript&quot;]"');
  expect(en).toContain('Copy colour {{colour}}');
});
