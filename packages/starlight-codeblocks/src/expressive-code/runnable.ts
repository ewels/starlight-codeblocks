import {
  AttachedPluginData,
  darken,
  type ExpressiveCodeLine,
  ensureColorContrastOnBackground,
  getFirstStaticColor,
  getStaticBackgroundColor,
  mix,
  PluginStyleSettings,
  type StyleVariant,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { type Element, type ElementContent, getClassNames, h, select, toText } from '@expressive-code/core/hast';
import { encodeCode } from '../client/shared/copy.ts';
import { clientJsModules } from '../client-modules.ts';
import { getRegistry } from '../registry.ts';
import { themedCss, tokenRule } from '../satteri/inline-code.ts';
import { uiTexts } from '../translations.ts';
import {
  addTitleBarControl,
  blockSetting,
  bundledLanguage,
  type CodeblocksPlugin,
  keepCopiedText,
  languageId,
  warn,
} from './core.ts';
import { decorateLine } from './line-states.ts';
import { getDirectives, getOutputLines, getRunLines, outputMark, runMark } from './notation.ts';
import { highlightOutput, isPlain } from './output-highlight.ts';
import { pythonSessionPrompts } from './shell-copy.ts';
import { onCode, PREFIX, solidCodeBackground, solidCodeForeground, themeColour } from './styles.ts';

export interface RunnableStyleSettings {
  /** The output panel, a shade darker than the code. */
  outputBackground: UnresolvedStyleValue;
  /** The font of the output, such as one with box-drawing characters for terminal panels. */
  outputFontFamily: UnresolvedStyleValue;
  outputLineHeight: UnresolvedStyleValue;
  /** Standard output. Needs 4.5:1 on the output background. */
  outputForeground: UnresolvedStyleValue;
  /** Standard error and run errors. Needs 4.5:1 on the output background. */
  errorForeground: UnresolvedStyleValue;
  /** The Output label, status messages and dim text in a run. Needs 4.5:1 on the output background. */
  mutedForeground: UnresolvedStyleValue;
  /** The border of the button under the block. Needs 3:1 on the code background. */
  buttonBorder: UnresolvedStyleValue;
  ansiBlack: UnresolvedStyleValue;
  ansiRed: UnresolvedStyleValue;
  ansiGreen: UnresolvedStyleValue;
  ansiYellow: UnresolvedStyleValue;
  ansiBlue: UnresolvedStyleValue;
  ansiMagenta: UnresolvedStyleValue;
  ansiCyan: UnresolvedStyleValue;
  ansiWhite: UnresolvedStyleValue;
  ansiBrightBlack: UnresolvedStyleValue;
  ansiBrightRed: UnresolvedStyleValue;
  ansiBrightGreen: UnresolvedStyleValue;
  ansiBrightYellow: UnresolvedStyleValue;
  ansiBrightBlue: UnresolvedStyleValue;
  ansiBrightMagenta: UnresolvedStyleValue;
  ansiBrightCyan: UnresolvedStyleValue;
  ansiBrightWhite: UnresolvedStyleValue;
}

const COLOURS = ['Black', 'Red', 'Green', 'Yellow', 'Blue', 'Magenta', 'Cyan', 'White'] as const;
type AnsiName = `ansi${'' | 'Bright'}${(typeof COLOURS)[number]}`;
/** The 16 terminal colours, in the order of their ANSI codes, for the output of real runs. */
const ANSI: AnsiName[] = [...COLOURS.map((c) => `ansi${c}` as const), ...COLOURS.map((c) => `ansiBright${c}` as const)];

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksRunnable: RunnableStyleSettings;
  }
}

type Context = Parameters<typeof onCode>[0];

/** The output background as a colour, for contrast sums. A site can set it to something that is not one. */
const outputBackground = (context: Context) =>
  getFirstStaticColor(context.resolveSetting('codeblocksRunnable.outputBackground')) ?? solidCodeBackground(context);

/** `colour`, lightened or darkened to at least `min` contrast on the output background. */
const onOutput = (context: Context, colour: string, min: number) =>
  ensureColorContrastOnBackground(colour, outputBackground(context), min);

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksRunnable: {
      // The same step in contrast in both: light themes need far less darkening for it.
      outputFontFamily: ({ resolveSetting }) => resolveSetting('codeFontFamily'),
      outputLineHeight: ({ resolveSetting }) => resolveSetting('codeLineHeight'),
      outputBackground: (context) => darken(solidCodeBackground(context), context.theme.type === 'dark' ? 0.25 : 0.04),
      outputForeground: (context) => onOutput(context, themeColour(context, 'terminal.ansiGreen'), 4.5),
      errorForeground: (context) => onOutput(context, themeColour(context, 'terminal.ansiRed'), 4.5),
      mutedForeground: (context) =>
        onOutput(
          context,
          getFirstStaticColor(context.resolveSetting('codeblocks.mutedForeground')) ?? context.theme.fg,
          4.5,
        ),
      buttonBorder: (context) =>
        onCode(context, mix(solidCodeForeground(context), solidCodeBackground(context), 0.5), 3),
      ...(Object.fromEntries(
        ANSI.map((name) => [
          name,
          (context: Context) => onOutput(context, themeColour(context, `terminal.${name}`), 4.5),
        ]),
      ) as Record<AnsiName, (context: Context) => string>),
    },
  },
});

const BUILT_IN = {
  python: 'starlight-codeblocks/runtimes/pyodide',
  javascript: 'starlight-codeblocks/runtimes/javascript',
  typescript: 'starlight-codeblocks/runtimes/typescript',
};

interface RunnableSettings {
  runtimes?: Record<string, string>;
  timeout?: number;
  label?: string;
  againLabel?: string;
  button?: RunButton;
  outputDelay?: number;
}

const runButtons = ['below', 'title', 'both'] as const;
export type RunButton = (typeof runButtons)[number];

/**
 * The runtime modules by language. Without `codeblocks()`, nothing bundles the modules, so the
 * values are URLs as written and there are no built-in runtimes.
 */
export function runtimeModules(runtimes: Record<string, string> | undefined, bundled: boolean): Record<string, string> {
  const site = Object.fromEntries(Object.entries(runtimes ?? {}).map(([lang, path]) => [languageId(lang), path]));
  return bundled ? { ...BUILT_IN, ...site } : site;
}

/** The file name of a bundled runtime module, in Astro's assets folder. */
export const runtimeFileName = (language: string) => `scb-runtime-${language.replace(/[^\w-]/g, '_')}.js`;

const cls = (suffix: string) => `${PREFIX}-run${suffix}`;

/** Any text but blank, for `blockSetting()`. */
const text = (raw: string) => (raw.trim() ? raw : undefined);

type Stream = 'stdout' | 'stderr';

const scriptedData = new AttachedPluginData<{
  waits: Record<number, number>;
  /** The output line where each part starts, when its stream differs from the part before. */
  streams: Record<number, Stream>;
  /** The output line after each `[!output]`, with its `lang=`, or `null` for the block's `runnable.outputLang`. */
  langs: Record<number, string | null>;
  /** The `lang=` of `[!run]`. */
  runLang?: string;
}>(() => ({ waits: {}, streams: {}, langs: {} }));

const milliseconds = (min: number) => (raw: string) =>
  /^\d+$/.test(raw) && Number(raw) >= min && Number(raw) <= 2 ** 31 - 1 ? Number(raw) : undefined;

/**
 * Token colours for highlighted output, switched with the theme as Expressive Code switches them in code lines,
 * which it does only inside `.ec-line`.
 */
const tokenStyles = (variants: StyleVariant[]) =>
  themedCss((i) => tokenRule(`& .${cls('-output')} :where(span[style^='--']:not([class]))`, i), variants);

/**
 * An element for each line of output that cannot print as plain text: a line with a mark, or a line in a language.
 * A marked line takes the colour of its label, so it keeps only its text.
 */
async function outputLineElements(
  context: Parameters<typeof warn>[0] & { styleVariants: StyleVariant[] },
  fallback: string | undefined,
  texts: string[],
  lines: readonly ExpressiveCodeLine[],
  langs: Record<number, string | null>,
) {
  const { codeBlock, styleVariants, config } = context;
  const backgrounds = styleVariants.map(
    (variant) =>
      getFirstStaticColor(variant.resolvedStyleSettings.get('codeblocksRunnable.outputBackground')) ??
      getStaticBackgroundColor(variant),
  );
  const lineLangs: (string | undefined)[] = [];
  let current = fallback;
  texts.forEach((_, i) => {
    if (i in langs) current = langs[i] ?? fallback;
    lineLangs.push(isPlain(current) ? undefined : current);
  });
  const tokens: (ElementContent[] | undefined)[] = [];
  const unknown = new Set<string>();
  for (let from = 0; from < texts.length; ) {
    const lang = lineLangs[from];
    let to = from + 1;
    while (to < texts.length && lineLangs[to] === lang) to++;
    if (lang) {
      const highlighted = await highlightOutput(
        texts.slice(from, to).join('\n'),
        lang,
        styleVariants,
        Math.max(4.5, config.minSyntaxHighlightingColorContrast),
        backgrounds,
      );
      if (highlighted) for (const [i, line] of highlighted.entries()) tokens[from + i] = line;
      else unknown.add(lang);
    }
    from = to;
  }
  for (const lang of unknown)
    warn(context, `Expressive Code does not know the output language \`${lang}\`. The output shows as plain text.`);
  const marked: boolean[] = [];
  const elements = texts.map((line, i) => {
    const own = tokens[i];
    const source = lines[i];
    const element = h('span', { class: cls('-line'), dataScbRunLine: String(i) }, own ? toText(h('span', own)) : line);
    marked[i] = !!source && decorateLine(codeBlock, source, () => lines, element, element, true);
    if (marked[i]) return element;
    return own ? h('span', { dataScbRunLine: String(i) }, own) : undefined;
  });
  return { elements, marked };
}

type Mode = 'click' | 'autorun' | 'static';

/** How the block shows its output, from `runnable.static` and `runnable.autorun`. Warns about a mode it cannot have. */
function runMode(context: Parameters<typeof warn>[0], scripted: boolean): Mode {
  const { metaOptions } = context.codeBlock;
  const autorun = metaOptions.getBoolean('runnable.autorun') ? 'autorun' : 'click';
  if (!metaOptions.getBoolean('runnable.static')) return autorun;
  if (!scripted) {
    warn(
      context,
      '`runnable.static` needs output in the block, after `[!output]` or in `runnable.output`. The block keeps its button.',
    );
    return autorun;
  }
  if (autorun === 'autorun')
    warn(context, '`runnable.autorun` has no effect with `runnable.static`, which has no button.');
  return 'static';
}

/** Adds a Run button to `runnable` blocks, and an output panel under the code. */

export function pluginRunnable({
  runtimes,
  timeout = 10000,
  label,
  againLabel,
  button = 'below',
  outputDelay = 200,
}: RunnableSettings = {}): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:runnable',
    styleSettings,
    baseStyles: ({ cssVar, styleVariants }) => `${tokenStyles(styleVariants)}
.frame:has(> .${cls('-output')}:not(:empty)) > :is(pre, .${PREFIX}-footnotes) { border-end-start-radius: 0; border-end-end-radius: 0; }
.${cls('-output')}:not(:empty) {
  padding: 9px 16px;
  border: ${cssVar('borderWidth')} solid ${cssVar('borderColor')};
  border-top: 0;
  border-radius: 0 0 ${cssVar('borderRadius')} ${cssVar('borderRadius')};
  background: ${cssVar('codeblocksRunnable.outputBackground')};
  font-family: ${cssVar('codeblocksRunnable.outputFontFamily')};
  font-size: ${cssVar('codeFontSize')};
  line-height: ${cssVar('codeblocksRunnable.outputLineHeight')};
}
.${cls('-output')} > * { display: block; margin: 0; padding: 0; border: 0; font: inherit; white-space: pre-wrap; overflow-wrap: anywhere; }
/* Wins over Expressive Code's \`.frame pre\`, which gives a \`pre\` the code background and a scroll bar. */
:is(.frame, figure) .${cls('-output')} > * { background: none; overflow: visible; }
.${cls('-label')}, .${cls('-status')} { color: ${cssVar('codeblocksRunnable.mutedForeground')}; }
.${cls('-label')} { display: block; margin-bottom: 2px; font-size: 0.72rem; }
.${cls('-stdout')} { color: ${cssVar('codeblocksRunnable.outputForeground')}; }
.${cls('-output')} { ${ANSI.map((name, i) => `--scb-ansi-${i}: ${cssVar(`codeblocksRunnable.${name}`)};`).join(' ')} --scb-ansi-dim: ${cssVar('codeblocksRunnable.mutedForeground')}; }
[data-scb-runnable-ansi] .${cls('-stdout')} { color: ${cssVar('codeForeground')}; }
.${cls('-stderr')} {
  color: ${cssVar('codeblocksRunnable.errorForeground')};
  border-inline-start: 2px solid currentColor;
  padding-inline-start: 0.75ch;
}
.${cls('-stdout')} + .${cls('-stderr')}, .${cls('-stderr')} + .${cls('-stdout')} { margin-top: 0.4rem; }
/* Expressive Code reverts the browser style of hidden elements. */
.${cls('-lines')} { display: none; }
/* The stream and token colours do not meet 4.5:1 on the line state tints, so a marked line takes the colour of its label. */
.${cls('-line')} {
  display: inline-block;
  box-sizing: border-box;
  width: calc(100% + 1.5ch);
  margin-inline: -0.75ch;
  padding-inline: calc(0.75ch - ${cssVar('codeblocksLineStates.barWidth')}) 0.75ch;
  border-inline-start: ${cssVar('codeblocksLineStates.barWidth')} solid var(--scbStateBar);
  background: var(--scbStateBg);
  color: var(--scbStateLabelFg);
  vertical-align: top;
}
.${cls('')}[aria-disabled='true'] { opacity: 0.6; cursor: progress; }
.${cls('-controls')} { display: flex; justify-content: center; padding-block-start: 12px; }
.${cls('-controls')} > .${cls('')}, .${cls('-start')} {
  box-sizing: border-box;
  min-height: 2rem;
  padding: 0.25rem 0.9rem;
  border: 1px solid ${cssVar('codeblocksRunnable.buttonBorder')};
  border-radius: 999px;
  background: ${cssVar('codeBackground')};
  color: ${cssVar('codeForeground')};
  font: 600 0.8125rem/1.3 ${cssVar('uiFontFamily')};
  cursor: pointer;
}
.${cls('-empty')} > pre { display: grid; place-items: center; min-height: 6rem; }
.${cls('-empty')} > pre > code { display: none; }
.${cls('-empty')}[data-scb-run-started] > pre { display: none; }
.${cls('-empty')}[data-scb-run-started] > .${cls('-output')}:not(:empty) { border-top: ${cssVar('borderWidth')} solid ${cssVar('borderColor')}; }
.${cls('-start')}.${cls('-fading')} { opacity: 0; }
@media (prefers-reduced-motion: no-preference) {
  .${cls('-start')} { transition: opacity 0.25s ease-out; }
}
.${cls('-controls')} > .${cls('')}:hover:not([aria-disabled='true']), .${cls('-start')}:hover:not([aria-disabled='true']) { border-color: ${cssVar('codeblocks.accent')}; }
@media (scripting: none) {
  .${cls('-controls')} { display: none; }
}
`,
    jsModules: clientJsModules,
    directives: {
      output: {
        docs: {
          description:
            'Starts the output that the **Run code** button prints instead of running the code. `[!output stderr]` starts lines that print as standard error, and `[!output stdout]` switches back. `lang=<language>` highlights the lines after it in that language, such as `ansi` for terminal colours. `[!output end]` ends the output; without it, the output goes to the end of the block. `[!code highlight]` and line states mark lines of output. The block needs no `runnable` and no runtime.',
          args: 'Optional. `stdout`, `stderr` or `end`, and `lang=<language>`.',
          example: { lang: 'sh', code: 'nextflow run hello.nf\n# [!output]\nHello world!' },
          page: 'features/run-code',
        },
      },
      run: {
        docs: {
          description:
            'Starts the code that the **Run code** button runs instead of the code that readers see. The lines leave the block, up to `[!run end]`, the next `[!output]` or the end of the block. `lang=<language>` sets the runtime, when it differs from the language of the block.',
          args: 'Optional. `lang=<language>`, or `end`.',
          example: {
            lang: 'sh',
            code: 'python greet.py\n# [!run lang=python]\nprint("Hello world!")',
          },
          page: 'features/run-code',
        },
      },
      wait: {
        docs: {
          description: 'Milliseconds to wait after this line of `[!output]`, before the next line prints.',
          args: 'Milliseconds.',
          example: { lang: 'sh', code: 'make\n# [!output]\nCompiling… # [!wait 2000]\nDone.' },
          page: 'features/run-code',
        },
      },
    },
    hooks: {
      preprocessCode(context) {
        const { codeBlock } = context;
        const runMarks = getDirectives(codeBlock, 'run');
        const marks = getDirectives(codeBlock, 'output');
        if (runMarks.length === 0 && marks.length === 0) return;
        const data = scriptedData.getOrCreateFor(codeBlock);
        for (const mark of runMarks.filter((d) => !runMark(d)))
          warn(context, '`[!run]` takes nothing, `lang=<language>` or `end`.', mark.sourceLine);
        const run = getRunLines(codeBlock);
        if (run.length === 0 && runMarks.some((d) => runMark(d)?.end))
          warn(context, '`[!run end]` needs a `[!run]` line before it.');
        data.runLang = runMarks.map(runMark).find((mark) => mark && !mark.end)?.lang;
        const output = getOutputLines(codeBlock);
        if (output.length === 0) {
          if (marks.some((d) => outputMark(d)?.stream === 'end'))
            warn(context, '`[!output end]` needs an `[!output]` line before it.');
        }
        for (const mark of marks.filter((d) => !outputMark(d)))
          warn(context, '`[!output]` takes `stdout`, `stderr` or `end`, and `lang=<language>`.', mark.sourceLine);
        let stream: Stream = 'stdout';
        for (const mark of output.length > 0 ? marks : []) {
          const next = outputMark(mark);
          if (!next || next.stream === 'end') continue;
          const index = output.indexOf(mark.lines[0] as ExpressiveCodeLine);
          if (index === -1) {
            warn(
              context,
              'A block has one output, so `[!output]` after `[!output end]` leaves its lines in the code.',
              mark.sourceLine,
            );
            continue;
          }
          data.langs[index] = next.lang ?? null;
          if (next.stream !== stream) data.streams[index] = stream = next.stream;
        }
        for (const wait of getDirectives(codeBlock, 'wait')) {
          const index = wait.lines[0] ? output.indexOf(wait.lines[0]) : -1;
          const ms = milliseconds(0)(wait.args[0] ?? '');
          if (index === -1 || ms === undefined || wait.args.length !== 1)
            warn(context, '`[!wait]` needs milliseconds, on a line of `[!output]`.', wait.sourceLine);
          else data.waits[index] = ms;
        }
        // Plugins before this one can delete a line of output, such as the frames plugin's file name comment.
        const current = codeBlock.getLines();
        const indices = [...output, ...run].map((line) => current.indexOf(line)).filter((i) => i !== -1);
        if (indices.length > 0) codeBlock.deleteLines(indices);
      },
      async postprocessRenderedBlock(context) {
        const { codeBlock, renderData } = context;
        const meta = codeBlock.metaOptions.getString('runnable.output');
        // `runnable.output` replaces the `[!output]` lines, and their waits, streams and marks with them.
        const own = scriptedData.getOrCreateFor(codeBlock);
        const { waits, streams, langs } = meta === undefined ? own : { waits: {}, streams: {}, langs: {} };
        const lines = meta === undefined ? getOutputLines(codeBlock) : [];
        // A fence line holds one line, so `\n` stands for a line break.
        const scripted =
          meta?.replace(/\\n/g, '\n') ?? (lines.length > 0 ? lines.map((line) => line.text).join('\n') : undefined);
        const run = getRunLines(codeBlock);
        const { metaOptions } = codeBlock;
        if (
          !metaOptions.getBoolean('runnable') &&
          !metaOptions.getBoolean('runnable.autorun') &&
          scripted === undefined &&
          run.length === 0
        )
          return;
        const figure = select('figure', renderData.blockAst);
        if (!figure) return;
        const mode = runMode(context, scripted !== undefined);
        const outputLang = metaOptions.getString('runnable.outputLang')?.trim() || undefined;
        if (scripted !== undefined && run.length > 0)
          warn(context, '`[!run]` has no effect in a block with scripted output: the button prints the output.');
        const say = uiTexts(context.locale);
        const buttonText = blockSetting(context, 'runnable.label', text, label ?? say('runnable.run'), 'some text');
        const again = blockSetting(
          context,
          'runnable.againLabel',
          text,
          againLabel ?? say('runnable.again'),
          'some text',
        );
        const texts = {
          output: say('runnable.output'),
          running: say('runnable.running'),
          error: `${say('runnable.error')} `,
        };
        const where = blockSetting(
          context,
          'runnable.button',
          (raw) => ((runButtons as readonly string[]).includes(raw) ? (raw as RunButton) : undefined),
          button,
          `one of ${runButtons.map((b) => `\`${b}\``).join(', ')}`,
        );
        const pre = select('pre', figure);
        const outputOnly = scripted !== undefined && !codeBlock.code.trim();
        /** Only output: the output or the button takes the place of the code, and nothing is left to copy. */
        const emptyBlock = (started: boolean) => {
          figure.properties.className = [...((figure.properties.className as string[]) ?? []), cls('-empty')];
          if (started) figure.properties.dataScbRunStarted = '';
          figure.children = figure.children.filter(
            (child) => !(child.type === 'element' && getClassNames(child).includes('copy')),
          );
        };
        const addButtons = (panel: Element) => {
          const runButton = (extra: string) =>
            h(
              'button',
              {
                type: 'button',
                class: `${cls('')} ${extra}${PREFIX}-no-print ${PREFIX}-needs-js`,
                dataScbRunAgain: again,
              },
              mode === 'autorun' ? again : buttonText,
            );
          if (where !== 'below') addTitleBarControl(renderData.blockAst, runButton(`${PREFIX}-btn `), context.locale);
          figure.children.push(panel);
          if (where === 'title') return;
          if (outputOnly && mode === 'click' && pre) {
            emptyBlock(false);
            pre.children.push(runButton(`${cls('-start')} `));
            return;
          }
          figure.children.push(h('div', { class: `${cls('-controls')} ${PREFIX}-no-print` }, [runButton('')]));
        };
        const livePanel = (runtimeTexts = {}) =>
          h('div', {
            class: cls('-output'),
            ariaLive: 'polite',
            dataScbTexts: JSON.stringify({ ...texts, ...runtimeTexts }),
          });
        if (scripted !== undefined) {
          const outputTexts = scripted.split('\n');
          const { elements: lineElements, marked } = await outputLineElements(
            context,
            outputLang,
            outputTexts,
            lines,
            langs,
          );
          for (const highlight of getDirectives(codeBlock, 'code highlight')) {
            const [line] = highlight.lines;
            const i = line ? lines.indexOf(line) : -1;
            if (i === -1 || marked[i]) continue;
            const message = '`[!code highlight]` on a line of output needs line states. The line prints without it.';
            warn(context, message, highlight.sourceLine);
          }
          const panelParts = () => {
            const parts: Element[] = [];
            let part: Element | undefined;
            outputTexts.forEach((line, i) => {
              if (!part || i in streams) {
                part =
                  streams[i] === 'stderr'
                    ? h('pre', { class: cls('-stderr') }, [h('span', { class: `${PREFIX}-sr-only` }, texts.error)])
                    : h('pre', { class: cls('-stdout') });
                parts.push(part);
              } else part.children.push({ type: 'text', value: '\n' });
              const element = lineElements[i];
              part.children.push(element ? structuredClone(element) : { type: 'text', value: line });
            });
            return [h('span', { class: cls('-label') }, texts.output), ...parts];
          };
          // The output of a scripted run is known, so the static and autorun modes show it from the build.
          const prefilled = mode !== 'click';
          const panel = mode === 'static' ? h('div', { class: cls('-output') }) : livePanel();
          if (prefilled) panel.children = panelParts();
          if (outputOnly && prefilled) emptyBlock(true);
          if (mode === 'static') {
            figure.children.push(panel);
            return;
          }
          figure.properties.dataScbRunnable = '';
          figure.properties.dataScbRunnableOutput = encodeCode(scripted);
          if (Object.keys(waits).length > 0) figure.properties.dataScbRunnableWaits = JSON.stringify(waits);
          if (Object.keys(streams).length > 0) figure.properties.dataScbRunnableStreams = JSON.stringify(streams);
          const kept = lineElements.filter((element): element is Element => element !== undefined);
          if (kept.length > 0) figure.children.push(h('div', { class: cls('-lines'), hidden: true }, kept));
          figure.properties.dataScbRunnableDelay = String(
            blockSetting(
              context,
              'runnable.outputDelay',
              milliseconds(0),
              outputDelay,
              'a whole number of milliseconds',
            ),
          );
          addButtons(panel);
          return;
        }
        const registry = getRegistry();
        const modules = runtimeModules(runtimes, !!registry);
        const runLanguage = run.length > 0 ? (own.runLang ?? codeBlock.language) : codeBlock.language;
        // Shiki has no pycon, but a pycon session runs on the Python runtime.
        const id = runLanguage === 'pycon' ? 'python' : languageId(runLanguage);
        const language = id && Object.hasOwn(modules, id) ? id : undefined;
        if (!language) {
          warn(
            context,
            `\`runnable\` needs a runtime for ${runLanguage || 'plain text'}. Add one to \`runnable.runtimes\`.`,
          );
          return;
        }
        figure.properties.dataScbRunnable = registry
          ? `${(registry.base ?? '/').replace(/\/?$/, '/')}${registry.assets ?? '_astro'}/${runtimeFileName(language)}`
          : modules[language];
        if (mode === 'autorun') figure.properties.dataScbRunnableAutorun = '';
        if (outputLang === 'ansi') figure.properties.dataScbRunnableAnsi = '';
        else if (!isPlain(outputLang))
          warn(
            context,
            `The output of a run shows as plain text with \`runnable.outputLang=${outputLang}\`. Only \`ansi\` colours a run.`,
          );
        const ms = blockSetting(
          context,
          'runnable.timeout',
          milliseconds(1),
          timeout,
          'a whole number of milliseconds, from 1 to 2147483647',
        );
        figure.properties.dataScbRunnableTimeout = String(ms);
        const packages = blockSetting(
          context,
          'runnable.packages',
          (raw) => raw.trim().split(/\s+/).join(' ') || undefined,
          '',
          'one or more package names',
        );
        if (packages) figure.properties.dataScbRunnablePackages = packages;
        keepCopiedText(renderData.blockAst, codeBlock.code);
        if (run.length > 0) {
          figure.properties.dataScbRunnableCode = encodeCode(run.map((line) => line.text).join('\n'));
        } else if (!select('.scb-shell-copy', figure)) {
          // With smart shell copy off, nothing else has taken the prompts and output out of a session.
          const session = pythonSessionPrompts(codeBlock.language, codeBlock.getLines());
          if (session.size > 0)
            figure.properties.dataScbRunnableSession = encodeCode(
              [...session].map(([line, prompt]) => line.text.slice(prompt.length)).join('\n'),
            );
        }
        const name = bundledLanguage(language)?.name ?? language;
        addButtons(
          livePanel({
            loading: say('runnable.loading', { language: name }),
            failed: say('runnable.loadFailed', { language: name }),
            empty: say('runnable.noOutput'),
            timeout: say('runnable.timeout', { count: ms / 1000 }),
          }),
        );
      },
    },
  };
}
