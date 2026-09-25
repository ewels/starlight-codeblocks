import { PluginStyleSettings, type UnresolvedStyleValue } from '@expressive-code/core';
import { h, select } from '@expressive-code/core/hast';
import { bundledLanguagesInfo } from 'shiki/langs';
import { clientJsModules } from '../client-modules.ts';
import { getRegistry } from '../registry.ts';
import { addTitleBarControl, type CodeblocksPlugin, warn } from './core.ts';
import { PREFIX } from './styles.ts';

export interface RunnableStyleSettings {
  /** Standard output. Needs 4.5:1 on the code background. */
  outputForeground: UnresolvedStyleValue;
  /** Standard error and run errors. Needs 4.5:1 on the code background. */
  errorForeground: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksRunnable: RunnableStyleSettings;
  }
}

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksRunnable: {
      outputForeground: ['#c3e88d', '#2f6b12'],
      errorForeground: ['#ff8080', '#c42b2b'],
    },
  },
});

interface RunnableSettings {
  runtimes?: Record<string, string>;
  timeout?: number;
}

/** The runtime modules by language. Without `codeblocks()`, nothing bundles the modules, so the values are URLs as written. */
export function runtimeModules(runtimes: Record<string, string> = {}) {
  return runtimes;
}

/** The file name of a bundled runtime module, in Astro's assets folder. */
export const runtimeFileName = (language: string) => `scb-runtime-${language.replace(/[^\w-]/g, '_')}.js`;

const cls = (suffix: string) => `${PREFIX}-run${suffix}`;

/** Adds a Run button to `runnable` blocks, and an output panel under the code. */
export function pluginRunnable({ runtimes, timeout = 10000 }: RunnableSettings = {}): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:runnable',
    styleSettings,
    baseStyles: ({ cssVar }) => `
.frame:has(> .${cls('-output')}:not(:empty)) > pre { border-end-start-radius: 0; border-end-end-radius: 0; }
.${cls('-output')}:not(:empty) {
  padding: 0.55rem 1.1rem 0.65rem;
  border: ${cssVar('borderWidth')} solid ${cssVar('borderColor')};
  border-top: 0;
  border-radius: 0 0 ${cssVar('borderRadius')} ${cssVar('borderRadius')};
  background: ${cssVar('codeBackground')};
  font-family: ${cssVar('codeFontFamily')};
  font-size: 0.8125rem;
  line-height: 1.55;
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
@media (scripting: none) {
  .${cls('')} { display: none; }
  .frame:not(.has-title):not(.is-terminal):has(.${PREFIX}-tools > .${cls('')}:only-child) .header { display: none; }
}`,
    jsModules: clientJsModules,
    hooks: {
      postprocessRenderedBlock(context) {
        const { codeBlock, renderData } = context;
        if (!codeBlock.metaOptions.getBoolean('runnable')) return;
        const figure = select('figure', renderData.blockAst);
        if (!figure) return;
        const modules = runtimeModules(runtimes);
        const info = bundledLanguagesInfo.find(
          (l) => l.id === codeBlock.language || l.aliases?.includes(codeBlock.language),
        );
        const language = [codeBlock.language, info?.id].find((l) => l && modules[l]);
        if (!language) {
          warn(
            context,
            `\`runnable\` needs a runtime for ${codeBlock.language || 'plain text'}. Add one to \`runnable.runtimes\`.`,
          );
          return;
        }
        const registry = getRegistry();
        figure.properties.dataScbRunnable = registry?.clientAssets
          ? `${(registry.base ?? '/').replace(/\/?$/, '/')}${registry.assets ?? '_astro'}/${runtimeFileName(language)}`
          : modules[language];
        figure.properties.dataScbRunnableName = info?.name ?? language;
        figure.properties.dataScbRunnableTimeout = String(timeout);
        addTitleBarControl(
          renderData.blockAst,
          h('button', { type: 'button', class: `${PREFIX}-btn ${cls('')} ${PREFIX}-no-print` }, 'Run'),
        );
        figure.children.push(h('div', { class: cls('-output'), ariaLive: 'polite' }));
      },
    },
  };
}
