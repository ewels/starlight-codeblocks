import {
  AttachedPluginData,
  type ExpressiveCodeLine,
  mix,
  PluginStyleSettings,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { type Element, getClassNames, h, select } from '@expressive-code/core/hast';
import { encodeCode } from '../client/shared/copy.ts';
import { clientJsModules } from '../client-modules.ts';
import { getRegistry } from '../registry.ts';
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
import { getDirectives, getOutputLines, outputMark } from './notation.ts';
import { pythonSessionPrompts } from './shell-copy.ts';
import { onCode, PREFIX, solidCodeBackground, solidCodeForeground, themeColour } from './styles.ts';

export interface RunnableStyleSettings {
  /** Standard output. Needs 4.5:1 on the code background. */
  outputForeground: UnresolvedStyleValue;
  /** Standard error and run errors. Needs 4.5:1 on the code background. */
  errorForeground: UnresolvedStyleValue;
  /** The border of the button under the block. Needs 3:1 on the code background. */
  buttonBorder: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksRunnable: RunnableStyleSettings;
  }
}

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksRunnable: {
      outputForeground: (context) => onCode(context, themeColour(context, 'terminal.ansiGreen'), 4.5),
      errorForeground: (context) => onCode(context, themeColour(context, 'terminal.ansiRed'), 4.5),
      buttonBorder: (context) =>
        onCode(context, mix(solidCodeForeground(context), solidCodeBackground(context), 0.5), 3),
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
}>(() => ({ waits: {}, streams: {} }));

const milliseconds = (min: number) => (raw: string) =>
  /^\d+$/.test(raw) && Number(raw) >= min && Number(raw) <= 2 ** 31 - 1 ? Number(raw) : undefined;

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
    baseStyles: ({ cssVar }) => `
.frame:has(> .${cls('-output')}:not(:empty)) > :is(pre, .${PREFIX}-footnotes) { border-end-start-radius: 0; border-end-end-radius: 0; }
.${cls('-output')}:not(:empty) {
  padding: 9px 16px;
  border: ${cssVar('borderWidth')} solid ${cssVar('borderColor')};
  border-top: 0;
  border-radius: 0 0 ${cssVar('borderRadius')} ${cssVar('borderRadius')};
  background: ${cssVar('codeBackground')};
  font-family: ${cssVar('codeFontFamily')};
  font-size: 0.78125rem;
  line-height: 1.65;
}
.${cls('-output')} > * { display: block; margin: 0; padding: 0; background: none; border: 0; font: inherit; white-space: pre-wrap; overflow-wrap: anywhere; }
.${cls('-label')}, .${cls('-status')} { color: ${cssVar('codeblocks.mutedForeground')}; }
.${cls('-label')} { display: block; margin-bottom: 2px; font-size: 0.72rem; }
.${cls('-stdout')} { color: ${cssVar('codeblocksRunnable.outputForeground')}; }
.${cls('-stderr')} {
  color: ${cssVar('codeblocksRunnable.errorForeground')};
  border-inline-start: 2px solid currentColor;
  padding-inline-start: 0.75ch;
}
.${cls('-stdout')} + .${cls('-stderr')}, .${cls('-stderr')} + .${cls('-stdout')} { margin-top: 0.4rem; }
/* Expressive Code reverts the browser style of hidden elements. */
.${cls('-marks')} { display: none; }
/* The output colours meet 4.5:1 only on the code background, so a marked line takes the text colour of its label. */
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
            'Starts the output that the **Run code** button prints instead of running the code. `[!output stderr]` starts lines that print as standard error, and `[!output stdout]` switches back. `[!output end]` ends the output; without it, the output goes to the end of the block. `[!code highlight]` and line states mark lines of output. The block needs no `runnable` and no runtime.',
          args: 'Optional. `stdout`, `stderr` or `end`.',
          example: { lang: 'sh', code: 'nextflow run hello.nf\n# [!output]\nHello world!' },
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
        const marks = getDirectives(codeBlock, 'output');
        if (marks.length === 0) return;
        for (const mark of marks.filter((d) => !outputMark(d)))
          warn(context, '`[!output]` takes nothing, `stdout`, `stderr` or `end`.', mark.sourceLine);
        const output = getOutputLines(codeBlock);
        if (output.length === 0) {
          if (marks.some((d) => outputMark(d) === 'end'))
            warn(context, '`[!output end]` needs an `[!output]` line before it.');
          return;
        }
        const data = scriptedData.getOrCreateFor(codeBlock);
        let stream: Stream = 'stdout';
        for (const mark of marks) {
          const next = outputMark(mark);
          if (!next || next === 'end') continue;
          const index = output.indexOf(mark.lines[0] as ExpressiveCodeLine);
          if (index === -1)
            warn(
              context,
              'A block has one output, so `[!output]` after `[!output end]` leaves its lines in the code.',
              mark.sourceLine,
            );
          else if (next !== stream) data.streams[index] = stream = next;
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
        const indices = output.map((line) => current.indexOf(line)).filter((i) => i !== -1);
        if (indices.length > 0) codeBlock.deleteLines(indices);
      },
      postprocessRenderedBlock(context) {
        const { codeBlock, renderData } = context;
        const meta = codeBlock.metaOptions.getString('runnable.output');
        // `runnable.output` replaces the `[!output]` lines, and their waits, streams and marks with them.
        const { waits, streams } =
          meta === undefined ? scriptedData.getOrCreateFor(codeBlock) : { waits: {}, streams: {} };
        const lines = meta === undefined ? getOutputLines(codeBlock) : [];
        // A fence line holds one line, so `\n` stands for a line break.
        const scripted =
          meta?.replace(/\\n/g, '\n') ?? (lines.length > 0 ? lines.map((line) => line.text).join('\n') : undefined);
        if (!codeBlock.metaOptions.getBoolean('runnable') && scripted === undefined) return;
        const figure = select('figure', renderData.blockAst);
        if (!figure) return;
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
        const addButtons = (runtimeTexts = {}) => {
          const runButton = (extra: string) =>
            h(
              'button',
              {
                type: 'button',
                class: `${cls('')} ${extra}${PREFIX}-no-print ${PREFIX}-needs-js`,
                dataScbRunAgain: again,
              },
              buttonText,
            );
          if (where !== 'below') addTitleBarControl(renderData.blockAst, runButton(`${PREFIX}-btn `), context.locale);
          figure.children.push(
            h('div', {
              class: cls('-output'),
              ariaLive: 'polite',
              dataScbTexts: JSON.stringify({ ...texts, ...runtimeTexts }),
            }),
          );
          if (where === 'title') return;
          const pre = select('pre', figure);
          if (scripted !== undefined && !codeBlock.code.trim() && pre) {
            // Only output: the button takes the place of the code, and nothing is left to copy.
            figure.properties.className = [...((figure.properties.className as string[]) ?? []), cls('-empty')];
            figure.children = figure.children.filter(
              (child) => !(child.type === 'element' && getClassNames(child).includes('copy')),
            );
            pre.children.push(runButton(`${cls('-start')} `));
            return;
          }
          figure.children.push(h('div', { class: `${cls('-controls')} ${PREFIX}-no-print` }, [runButton('')]));
        };
        if (scripted !== undefined) {
          figure.properties.dataScbRunnable = '';
          figure.properties.dataScbRunnableOutput = encodeCode(scripted);
          if (Object.keys(waits).length > 0) figure.properties.dataScbRunnableWaits = JSON.stringify(waits);
          if (Object.keys(streams).length > 0) figure.properties.dataScbRunnableStreams = JSON.stringify(streams);
          const marked = new Map<ExpressiveCodeLine, Element>();
          lines.forEach((line, i) => {
            const element = h('span', { class: cls('-line'), dataScbRunLine: String(i) }, line.text);
            if (decorateLine(codeBlock, line, () => lines, element, element, true)) marked.set(line, element);
          });
          if (marked.size > 0)
            figure.children.push(h('div', { class: cls('-marks'), hidden: true }, [...marked.values()]));
          for (const highlight of getDirectives(codeBlock, 'code highlight')) {
            const [line] = highlight.lines;
            if (!line || !lines.includes(line) || marked.has(line)) continue;
            const message = '`[!code highlight]` on a line of output needs line states. The line prints without it.';
            warn(context, message, highlight.sourceLine);
          }
          figure.properties.dataScbRunnableDelay = String(
            blockSetting(
              context,
              'runnable.outputDelay',
              milliseconds(0),
              outputDelay,
              'a whole number of milliseconds',
            ),
          );
          addButtons();
          return;
        }
        const registry = getRegistry();
        const modules = runtimeModules(runtimes, !!registry);
        // Shiki has no pycon, but a pycon session runs on the Python runtime.
        const id = codeBlock.language === 'pycon' ? 'python' : languageId(codeBlock.language);
        const language = id && Object.hasOwn(modules, id) ? id : undefined;
        if (!language) {
          warn(
            context,
            `\`runnable\` needs a runtime for ${codeBlock.language || 'plain text'}. Add one to \`runnable.runtimes\`.`,
          );
          return;
        }
        figure.properties.dataScbRunnable = registry
          ? `${(registry.base ?? '/').replace(/\/?$/, '/')}${registry.assets ?? '_astro'}/${runtimeFileName(language)}`
          : modules[language];
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
        // With smart shell copy off, nothing else has taken the prompts and output out of a session.
        if (!select('.scb-shell-copy', figure)) {
          const session = pythonSessionPrompts(codeBlock.language, codeBlock.getLines());
          if (session.size > 0)
            figure.properties.dataScbRunnableSession = encodeCode(
              [...session].map(([line, prompt]) => line.text.slice(prompt.length)).join('\n'),
            );
        }
        const name = bundledLanguage(language)?.name ?? language;
        addButtons({
          loading: say('runnable.loading', { language: name }),
          failed: say('runnable.loadFailed', { language: name }),
          empty: say('runnable.noOutput'),
          timeout: say('runnable.timeout', { count: ms / 1000 }),
        });
      },
    },
  };
}
