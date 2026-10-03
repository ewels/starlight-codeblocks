import { mix, PluginStyleSettings, type UnresolvedStyleValue } from '@expressive-code/core';
import { h, select } from '@expressive-code/core/hast';
import { encodeCode } from '../client/shared/copy.ts';
import { clientJsModules } from '../client-modules.ts';
import { getRegistry } from '../registry.ts';
import {
  addTitleBarControl,
  blockSetting,
  bundledLanguage,
  type CodeblocksPlugin,
  keepCopiedText,
  languageId,
  warn,
} from './core.ts';
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

const PYODIDE_RUNTIME = 'starlight-codeblocks/runtimes/pyodide';

interface RunnableSettings {
  runtimes?: Record<string, string>;
  timeout?: number;
  label?: string;
  againLabel?: string;
  button?: RunButton;
  outputDelay?: number;
}

export const runButtons = ['below', 'title', 'both'] as const;
export type RunButton = (typeof runButtons)[number];

/**
 * The runtime modules by language. Without `codeblocks()`, nothing bundles the modules, so the
 * values are URLs as written and there is no built-in Python runtime.
 */
export function runtimeModules(runtimes: Record<string, string> | undefined, bundled: boolean): Record<string, string> {
  const site = Object.fromEntries(Object.entries(runtimes ?? {}).map(([lang, path]) => [languageId(lang), path]));
  return bundled ? { python: PYODIDE_RUNTIME, ...site } : site;
}

/** The file name of a bundled runtime module, in Astro's assets folder. */
export const runtimeFileName = (language: string) => `scb-runtime-${language.replace(/[^\w-]/g, '_')}.js`;

const cls = (suffix: string) => `${PREFIX}-run${suffix}`;

/** Any text but blank, for `blockSetting()`. */
const text = (raw: string) => (raw.trim() ? raw : undefined);

const milliseconds = (min: number) => (raw: string) =>
  /^\d+$/.test(raw) && Number(raw) >= min && Number(raw) <= 2 ** 31 - 1 ? Number(raw) : undefined;

/** Adds a Run button to `runnable` blocks, and an output panel under the code. */

export function pluginRunnable({
  runtimes,
  timeout = 10000,
  label = 'Run code',
  againLabel = 'Run again',
  button = 'below',
  outputDelay = 400,
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
.${cls('-output')} > * { margin: 0; padding: 0; background: none; border: 0; font: inherit; white-space: pre-wrap; overflow-wrap: anywhere; }
.${cls('-label')}, .${cls('-status')} { color: ${cssVar('codeblocks.mutedForeground')}; }
.${cls('-label')} { display: block; margin-bottom: 2px; font-size: 0.72rem; }
.${cls('-stdout')} { color: ${cssVar('codeblocksRunnable.outputForeground')}; }
.${cls('-stderr')} {
  color: ${cssVar('codeblocksRunnable.errorForeground')};
  border-inline-start: 2px solid currentColor;
  padding-inline-start: 0.75ch;
}
.${cls('-stdout')} + .${cls('-stderr')} { margin-top: 0.4rem; }
.${cls('')}[aria-disabled='true'] { opacity: 0.6; cursor: progress; }
.${cls('-controls')} { display: flex; justify-content: center; padding-block-start: 12px; }
.${cls('-controls')} > .${cls('')} {
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
.${cls('-controls')} > .${cls('')}:hover:not([aria-disabled='true']) { border-color: ${cssVar('codeblocks.accent')}; }
@media (scripting: none) {
  .${cls('-controls')} { display: none; }
}
`,
    jsModules: clientJsModules,
    hooks: {
      postprocessRenderedBlock(context) {
        const { codeBlock, renderData } = context;
        const scripted = codeBlock.metaOptions.getString('runnable.output');
        if (!codeBlock.metaOptions.getBoolean('runnable') && scripted === undefined) return;
        const figure = select('figure', renderData.blockAst);
        if (!figure) return;
        const buttonText = blockSetting(context, 'runnable.label', text, label, 'some text');
        const again = blockSetting(context, 'runnable.againLabel', text, againLabel, 'some text');
        const where = blockSetting(
          context,
          'runnable.button',
          (raw) => ((runButtons as readonly string[]).includes(raw) ? (raw as RunButton) : undefined),
          button,
          `one of ${runButtons.map((b) => `\`${b}\``).join(', ')}`,
        );
        const addButtons = () => {
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
          if (where !== 'below') addTitleBarControl(renderData.blockAst, runButton(`${PREFIX}-btn `));
          figure.children.push(h('div', { class: cls('-output'), ariaLive: 'polite' }));
          if (where !== 'title')
            figure.children.push(h('div', { class: `${cls('-controls')} ${PREFIX}-no-print` }, [runButton('')]));
        };
        if (scripted !== undefined) {
          figure.properties.dataScbRunnable = '';
          // A fence line holds one line, so `\n` stands for a line break.
          figure.properties.dataScbRunnableOutput = encodeCode(scripted.replace(/\\n/g, '\n'));
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
        figure.properties.dataScbRunnableName = bundledLanguage(language)?.name ?? language;
        figure.properties.dataScbRunnableTimeout = String(
          blockSetting(
            context,
            'runnable.timeout',
            milliseconds(1),
            timeout,
            'a whole number of milliseconds, from 1 to 2147483647',
          ),
        );
        keepCopiedText(renderData.blockAst, codeBlock.code);
        // With smart shell copy off, nothing else has taken the prompts and output out of a session.
        if (!select('.scb-shell-copy', figure)) {
          const session = pythonSessionPrompts(codeBlock.language, codeBlock.getLines());
          if (session.size > 0)
            figure.properties.dataScbRunnableSession = encodeCode(
              [...session].map(([line, prompt]) => line.text.slice(prompt.length)).join('\n'),
            );
        }
        addButtons();
      },
    },
  };
}
