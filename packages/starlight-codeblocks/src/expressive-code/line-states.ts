import {
  AttachedPluginData,
  type ExpressiveCodeLine,
  ensureColorContrastOnBackground,
  mix,
  onBackground,
  PluginStyleSettings,
  type StyleResolverFn,
  setAlpha,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { addClassName, type ElementContent, h, select } from '@expressive-code/core/hast';
import type { LineStateDefinition } from '../options.ts';
import { type CodeblocksPlugin, ensureTextContrast, resolveRange } from './core.ts';
import { inlineMarkdown } from './inline-markdown.ts';
import type { DirectiveSpecs } from './notation.ts';
import { getDirectives } from './notation.ts';
import { PREFIX, solidCodeBackground } from './styles.ts';

/**
 * Settings of the `codeblocksLineStates` group. Each state also has `<state>` (the bar colour),
 * `<state>Background`, `<state>LabelBackground` and `<state>LabelForeground`.
 */
export interface LineStatesStyleSettings {
  barWidth: UnresolvedStyleValue;
  labelFontSize: UnresolvedStyleValue;
  labelRadius: UnresolvedStyleValue;
  [key: string]: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksLineStates: LineStatesStyleSettings;
  }
}

export const builtInStates: Record<string, LineStateDefinition> = {
  error: { label: 'Error', colour: { dark: '#ff6b6b', light: '#d03535' } },
  warning: { label: 'Warning', colour: { dark: '#f5b942', light: '#a3690a' } },
  info: { label: 'Note', colour: { dark: '#6cb8ff', light: '#2369c0' } },
};

type Context = Parameters<StyleResolverFn>[0];
type Resolve = Context['resolveSetting'];
const get = (resolve: Resolve, key: string) => resolve(`codeblocksLineStates.${key}` as never);
const lineBackground = (context: Context, name: string) =>
  onBackground(get(context.resolveSetting, `${name}Background`), solidCodeBackground(context));

function stateSettings(name: string, { colour }: LineStateDefinition) {
  return {
    [name]: [colour.dark, colour.light],
    [`${name}Background`]: ({ resolveSetting }: Context) => setAlpha(get(resolveSetting, name), 0.15),
    [`${name}LabelBackground`]: ({ resolveSetting }: Context) => setAlpha(get(resolveSetting, name), 0.2),
    [`${name}LabelForeground`]: (context: Context) =>
      ensureColorContrastOnBackground(
        mix(get(context.resolveSetting, name), context.resolveSetting('codeForeground'), 0.5),
        onBackground(get(context.resolveSetting, `${name}LabelBackground`), lineBackground(context, name)),
        5,
      ),
  };
}

const stateData = new AttachedPluginData<{
  states: Map<ExpressiveCodeLine, { name: string; messages: string[] }[]>;
}>(() => ({ states: new Map() }));

const cls = (suffix: string) => `${PREFIX}-state${suffix}`;

/** Tints lines as errors, warnings, notes or custom states, with an optional message after the code. */
export function pluginLineStates({
  states = {},
}: {
  states?: Record<string, LineStateDefinition>;
} = {}): CodeblocksPlugin {
  const all = { ...builtInStates, ...states };
  const directives: DirectiveSpecs = {};
  for (const [name, { label }] of Object.entries(all)) {
    directives[`code ${name}`] = {
      placement: 'end',
      text: true,
      docs: {
        description: `Marks the line with the "${label}" state. Text after the directive becomes the message.`,
        args: 'Optional. The message.',
        example: { lang: 'js', code: `const retries = -1 // [!code ${name}] Must be 0 or more` },
        page: 'features/line-states',
      },
    };
  }
  return {
    name: 'starlight-codeblocks:line-states',
    directives,
    styleSettings: new PluginStyleSettings({
      defaultValues: {
        codeblocksLineStates: Object.assign(
          { barWidth: '3px', labelFontSize: '0.75rem', labelRadius: '3px' },
          ...Object.entries(all).map(([name, state]) => stateSettings(name, state)),
        ),
      },
    }),
    baseStyles: ({ cssVar }) => {
      const v = (key: string) => cssVar(`codeblocksLineStates.${key}` as never);
      return `
.${cls('')} { background: var(--scbStateBg); }
.${cls('')} .code { --ecLineBrdCol: var(--scbStateBar); --ecGtrBrdWd: ${v('barWidth')}; }
.${cls('-label')} {
  display: inline-block;
  margin-inline-start: 2.5ch;
  padding: 0 0.5rem;
  border-radius: ${v('labelRadius')};
  background: var(--scbStateLabelBg);
  color: var(--scbStateLabelFg);
  font-size: ${v('labelFontSize')};
  line-height: 1.55;
  white-space: nowrap;
  vertical-align: 0.05em;
}
.${cls('-label')} strong { margin-inline-end: 0.125rem; font-weight: 600; }
.${cls('-label')}, .${cls('-prefix')} { user-select: none; -webkit-user-select: none; }
${Object.keys(all)
  .map(
    (name) => `.${cls(`-${name}`)} {
  --scbStateBar: ${v(name)};
  --scbStateBg: ${v(`${name}Background`)};
  --scbStateLabelBg: ${v(`${name}LabelBackground`)};
  --scbStateLabelFg: ${v(`${name}LabelForeground`)};
}`,
  )
  .join('\n')}`;
    },
    hooks: {
      preprocessMetadata(context) {
        const lineStates = stateData.getOrCreateFor(context.codeBlock).states;
        const add = (line: ExpressiveCodeLine, name: string, message?: string) => {
          const list = lineStates.get(line) ?? [];
          const entry = list.find((state) => state.name === name) ?? { name, messages: [] };
          if (!list.includes(entry)) list.push(entry);
          if (message) entry.messages.push(message);
          lineStates.set(line, list);
        };
        for (const name of Object.keys(all)) {
          for (const line of resolveRange(context, name) ?? []) add(line, name);
          for (const directive of getDirectives(context.codeBlock, `code ${name}`)) {
            for (const [i, line] of directive.lines.entries()) add(line, name, i === 0 ? directive.text : undefined);
          }
        }
      },
      postprocessAnnotations(context) {
        for (const [line, list] of stateData.getOrCreateFor(context.codeBlock).states) {
          for (const { name } of list) {
            ensureTextContrast(context, line, (v) => [
              v.resolvedStyleSettings.get(`codeblocksLineStates.${name}Background` as never),
            ]);
          }
        }
      },
      postprocessRenderedLine({ codeBlock, line, renderData }) {
        const list = stateData.getOrCreateFor(codeBlock).states.get(line);
        const code = list && select('.code', renderData.lineAst);
        if (!list || !code) return;
        addClassName(renderData.lineAst, cls(''));
        const labels = list.map(({ name }) => all[name]?.label ?? name);
        const labelNodes: ElementContent[] = [];
        list.forEach(({ name, messages }, i) => {
          addClassName(renderData.lineAst, cls(`-${name}`));
          for (const message of messages) {
            labelNodes.push(
              h('span', { class: cls('-label') }, [
                h('strong', { ariaHidden: 'true' }, labels[i]),
                { type: 'text', value: ' ' },
                ...inlineMarkdown(message),
              ]),
            );
          }
        });
        code.children.unshift(h('span', { class: `${cls('-prefix')} ${PREFIX}-sr-only` }, `${labels.join(', ')}:`));
        code.children.push(...labelNodes);
      },
    },
  };
}
