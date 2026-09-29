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
import { isHiddenLine } from './hidden-lines.ts';
import { inlineMarkdown } from './inline-markdown.ts';
import { builtInDirectives, type DirectiveSpecs, getDirectives } from './notation.ts';
import { onCode, PREFIX, solidCodeBackground, themeColour } from './styles.ts';

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

/** The built-in states take their colour from the theme's colour of the same name. */
export const builtInStates: Record<string, { label: string; themeColour: string }> = {
  error: { label: 'Error', themeColour: 'editorError.foreground' },
  warning: { label: 'Warning', themeColour: 'editorWarning.foreground' },
  info: { label: 'Note', themeColour: 'editorInfo.foreground' },
  success: { label: 'Success', themeColour: 'terminal.ansiGreen' },
};

/** Expressive Code's line markers, whose directives take a message in the same label. */
export const markers: Record<string, string> = { 'code ++': 'ins', 'code --': 'del', 'code highlight': 'mark' };

function markerSettings(marker: string) {
  const border = ({ resolveSetting }: Context) => resolveSetting(`textMarkers.${marker}BorderColor` as never);
  return {
    [`${marker}LabelBackground`]: (context: Context) => setAlpha(border(context), 0.2),
    [`${marker}LabelForeground`]: (context: Context) =>
      ensureColorContrastOnBackground(
        mix(border(context), context.resolveSetting('codeForeground'), 0.5),
        onBackground(
          get(context.resolveSetting, `${marker}LabelBackground`),
          onBackground(
            context.resolveSetting(`textMarkers.${marker}Background` as never),
            solidCodeBackground(context),
          ),
        ),
        5,
      ),
  };
}

/** Other names for built-in states, in the attribute and the directive. */
export const stateAliases: Record<string, string> = { note: 'info', warn: 'warning' };

type Context = Parameters<StyleResolverFn>[0];
type Resolve = Context['resolveSetting'];
const get = (resolve: Resolve, key: string) => resolve(`codeblocksLineStates.${key}` as never);
const lineBackground = (context: Context, name: string) =>
  onBackground(get(context.resolveSetting, `${name}Background`), solidCodeBackground(context));

function stateSettings(name: string, state: LineStateDefinition | (typeof builtInStates)[string]) {
  return {
    [name]:
      'themeColour' in state
        ? (context: Context) => onCode(context, themeColour(context, state.themeColour), 3)
        : [state.colour.dark, state.colour.light],
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
  markers: Map<ExpressiveCodeLine, { marker: string; message: string }[]>;
}>(() => ({ states: new Map(), markers: new Map() }));

const cls = (suffix: string) => `${PREFIX}-state${suffix}`;

/** Tints lines as errors, warnings, notes, successes or custom states, with an optional message after the code. */
export function pluginLineStates({
  states = {},
  prefix = true,
}: {
  states?: Record<string, LineStateDefinition>;
  prefix?: boolean;
} = {}): CodeblocksPlugin {
  const all = { ...builtInStates, ...states };
  const names = { ...Object.fromEntries(Object.keys(all).map((name) => [name, name])), ...stateAliases };
  const directives: DirectiveSpecs = {};
  for (const [name, state] of Object.entries(names)) {
    const label = all[state]?.label;
    directives[`code ${name}`] = {
      placement: 'end',
      text: true,
      docs: {
        description:
          name === state
            ? `Marks the line with the "${label}" state. Text after the directive becomes the message.`
            : `The same as \`[!code ${state}]\`.`,
        args: 'Optional. The message.',
        example: { lang: 'js', code: `const retries = -1 // [!code ${name}] Must be 0 or more` },
        page: 'features/line-states',
      },
    };
  }
  // Without line states, the text stays in the comment.
  for (const name of Object.keys(markers))
    directives[name] = { ...builtInDirectives[name], placement: 'end', text: true };
  return {
    name: 'starlight-codeblocks:line-states',
    directives,
    styleSettings: new PluginStyleSettings({
      defaultValues: {
        codeblocksLineStates: Object.assign(
          { barWidth: '3px', labelFontSize: '0.75rem', labelRadius: '3px' },
          ...Object.entries(all).map(([name, state]) => stateSettings(name, state)),
          ...Object.values(markers).map(markerSettings),
        ),
      },
    }),
    baseStyles: ({ cssVar }) => {
      const v = (key: string) => cssVar(`codeblocksLineStates.${key}` as never);
      return `
.${cls('')} { background: var(--scbStateBg); }
.ec-line.${cls('')} .code { --ecLineBrdCol: var(--scbStateBar); --ecGtrBrdWd: ${v('barWidth')}; }
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
  vertical-align: 0.09em;
}
/* The space after the name stays in the text for reading without styles. In monospace it is 1ch wide. */
.${cls('-label')} strong { margin-inline-end: calc(6px - 1ch); font-weight: 600; }
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
  .join('\n')}
${Object.values(markers)
  .map(
    (marker) => `.${cls(`-label-${marker}`)} {
  --scbStateLabelBg: ${v(`${marker}LabelBackground`)};
  --scbStateLabelFg: ${v(`${marker}LabelForeground`)};
}`,
  )
  .join('\n')}`;
    },
    hooks: {
      preprocessCode(context) {
        const lineStates = stateData.getOrCreateFor(context.codeBlock).states;
        const add = (line: ExpressiveCodeLine, name: string, message?: string) => {
          const list = lineStates.get(line) ?? [];
          const entry = list.find((state) => state.name === name) ?? { name, messages: [] };
          if (!list.includes(entry)) list.push(entry);
          if (message) entry.messages.push(message);
          lineStates.set(line, list);
        };
        for (const [name, state] of Object.entries(names)) {
          for (const line of resolveRange(context, name) ?? []) add(line, state);
          for (const directive of getDirectives(context.codeBlock, `code ${name}`)) {
            for (const [i, line] of directive.lines.entries()) add(line, state, i === 0 ? directive.text : undefined);
          }
        }
        const lineMarkers = stateData.getOrCreateFor(context.codeBlock).markers;
        for (const [name, marker] of Object.entries(markers)) {
          for (const { lines, text } of getDirectives(context.codeBlock, name)) {
            const line = lines[0];
            if (line && text) lineMarkers.set(line, [...(lineMarkers.get(line) ?? []), { marker, message: text }]);
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
        const { states, markers: lineMarkers } = stateData.getOrCreateFor(codeBlock);
        const code = select('.code', renderData.lineAst);
        if (!code) return;
        for (const { marker, message } of lineMarkers.get(line) ?? []) {
          code.children.push(
            h('span', { class: `${cls('-label')} ${cls(`-label-${marker}`)}` }, inlineMarkdown(message)),
          );
        }
        const list = states.get(line);
        if (!list) return;
        addClassName(renderData.lineAst, cls(''));
        const lines = codeBlock.getLines();
        // A hidden line above does not count: readers would see the run without its name.
        const above = lines.slice(0, lines.indexOf(line)).findLast((l) => !isHiddenLine(codeBlock, l));
        const previous = (above && states.get(above)) || [];
        const labels = list.map(({ name }) => all[name]?.label ?? name);
        const labelNodes: ElementContent[] = [];
        list.forEach(({ name, messages }, i) => {
          addClassName(renderData.lineAst, cls(`-${name}`));
          for (const message of messages) {
            labelNodes.push(
              h('span', { class: cls('-label') }, [
                ...(prefix
                  ? [h('strong', { ariaHidden: 'true' }, labels[i]), { type: 'text', value: ' ' } as const]
                  : []),
                ...inlineMarkdown(message),
              ]),
            );
          }
          // So that the colour does not carry the state alone: the first line of a run shows the name.
          if (messages.length === 0 && !previous.some((state) => state.name === name)) {
            labelNodes.push(h('span', { class: cls('-label') }, [h('strong', { ariaHidden: 'true' }, labels[i])]));
          }
        });
        code.children.unshift(h('span', { class: `${cls('-prefix')} ${PREFIX}-sr-only` }, `${labels.join(', ')}:`));
        code.children.push(...labelNodes);
      },
    },
  };
}
