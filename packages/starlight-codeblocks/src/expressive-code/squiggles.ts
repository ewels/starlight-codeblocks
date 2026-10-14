import {
  type AnnotationRenderOptions,
  AttachedPluginData,
  ExpressiveCodeAnnotation,
  type ExpressiveCodeLine,
  ensureColorContrastOnBackground,
  PluginStyleSettings,
  type StyleResolverFn,
  type UnresolvedStyleValue,
} from '@expressive-code/core';
import { type ElementContent, h, select, toText } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { blockUid, type CodeblocksPlugin, lineNumber, warn } from './core.ts';
import { inlineMarkdown } from './inline-markdown.ts';
import { builtInStates, stateAliases } from './line-states.ts';
import { type DirectiveSpecs, getDirectives } from './notation.ts';
import { onCode, PREFIX, themeColour } from './styles.ts';

export interface SquigglesStyleSettings {
  error: UnresolvedStyleValue;
  warning: UnresolvedStyleValue;
  info: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksSquiggles: SquigglesStyleSettings;
  }
}

type Context = Parameters<StyleResolverFn>[0];

/** The line states of the same names give the theme colours. The labels are VS Code's, so `info` reads Info. */
const stateColour = (state: string) => String(builtInStates[state]?.themeColour);

export const severities = {
  error: { label: 'Error', themeColour: stateColour('error') },
  warning: { label: 'Warning', themeColour: stateColour('warning') },
  info: { label: 'Info', themeColour: stateColour('info') },
};

type Severity = keyof typeof severities;

const aliases = stateAliases as Record<string, Severity>;

const colour = (key: string) => (context: Context) =>
  ensureColorContrastOnBackground(
    onCode(context, themeColour(context, key), 3),
    context.resolveSetting('codeblocks.popoverBackground'),
    3,
  );

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksSquiggles: {
      error: colour(severities.error.themeColour),
      warning: colour(severities.warning.themeColour),
      info: colour(severities.info.themeColour),
    },
  },
});

const cls = (suffix = '') => `${PREFIX}-squiggle${suffix}`;

/** VS Code's squiggle: 6 × 3 px, repeated along the bottom of the text. A mask, so that the colour can be a CSS variable. */
const WAVE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 6 3' width='6' height='3'%3E%3Cpolygon points='5.5,0 2.5,3 1.1,3 4.1,0'/%3E%3Cpolygon points='4,0 6,2 6,0.6 5.4,0'/%3E%3Cpolygon points='0,2 1,3 2.4,3 0,0.6'/%3E%3C/svg%3E\")";

const icon = (path: string) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='${path}'/%3E%3C/svg%3E")`;

const ICONS: Record<Severity, string> = {
  error: icon(
    'M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm2.8 9.1-.7.7L8 8.7l-2.1 2.1-.7-.7L7.3 8 5.2 5.9l.7-.7L8 7.3l2.1-2.1.7.7L8.7 8z',
  ),
  warning: icon('M8 1 0.5 14.5h15zm.6 11.5h-1.2v-1.2h1.2zm0-2.4h-1.2V5.8h1.2z'),
  info: icon('M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.6 11H7.4V7h1.2zm0-6.4H7.4V4.4h1.2z'),
};

interface Squiggle {
  severity: Severity;
  text: ElementContent[];
  line: ExpressiveCodeLine;
}

const squiggleData = new AttachedPluginData<{ squiggles: Squiggle[] }>(() => ({ squiggles: [] }));

class SquiggleAnnotation extends ExpressiveCodeAnnotation {
  constructor(
    private readonly squiggle: Squiggle,
    private readonly anchor: string,
    inlineRange: { columnStart: number; columnEnd: number },
  ) {
    // Last, so that the tokens of the range merge into one node and the wave runs on without a break.
    super({ inlineRange, renderPhase: 'latest' });
  }
  render({ nodesToTransform }: AnnotationRenderOptions) {
    const { severity, text } = this.squiggle;
    const { label } = severities[severity];
    const kind = `${cls()} ${cls(`-${severity}`)}`;
    // A later annotation that overlaps part of the range splits it. Only the first part opens the message.
    return nodesToTransform.map((node, i) =>
      i > 0
        ? h('span', { class: kind }, [node])
        : h('span', { class: kind, tabindex: '0', style: `anchor-name:${this.anchor}` }, [
            node,
            h(
              'span',
              { class: `${PREFIX}-sr-only` },
              ` (${label}${text.length ? `: ${toText(h('span', text))}` : ''})`,
            ),
            h(
              'span',
              {
                class: `${PREFIX}-float ${cls('-popover')} ${PREFIX}-no-print`,
                popover: 'manual',
                style: `position-anchor:${this.anchor}`,
              },
              [h('span', { class: cls('-label') }, label), ...text],
            ),
          ]),
    );
  }
}

const directives: DirectiveSpecs = Object.fromEntries([
  ...Object.entries(severities).map(([name, { label }]) => [
    name,
    {
      text: true,
      docs: {
        description: `Draws a wavy ${label.toLowerCase()} line under \`/text/\` on the line. Text after the directive shows when a reader hovers over the text or focuses it.`,
        args: 'Optional. `/text/` to underline, else the whole line. Then the message.',
        example: {
          lang: 'js',
          code: `const port = proces.env.PORT // [!${name} /proces/] Cannot find name \`proces\`.`,
        },
        page: 'features/squiggles',
      },
    },
  ]),
  ...Object.entries(aliases).map(([name, severity]) => [
    name,
    {
      text: true,
      docs: {
        description: `The same as \`[!${severity}]\`.`,
        example: { lang: 'js', code: `let count = 0 // [!${name} /count/]` },
        page: 'features/squiggles',
      },
    },
  ]),
]);

/** Draws `[!error /text/]`, `[!warning /text/]` and `[!info /text/]` as a wavy line under the text, with an optional message. */
export function pluginSquiggles(): CodeblocksPlugin {
  return {
    name: 'starlight-codeblocks:squiggles',
    directives,
    styleSettings,
    jsModules: clientJsModules,
    baseStyles: ({ cssVar }) => `
${Object.keys(severities)
  .map(
    (s) =>
      `.${cls(`-${s}`)} { --scb-squiggle: ${cssVar(`codeblocksSquiggles.${s}` as never)}; --scb-squiggle-icon: ${ICONS[s as Severity]}; }`,
  )
  .join('\n')}
.${cls()} { position: relative; }
.${cls()}::after {
  content: '';
  position: absolute;
  inset-inline: 0;
  bottom: -1px;
  height: 3px;
  background: var(--scb-squiggle);
  -webkit-mask: ${WAVE} repeat-x left bottom / 6px 3px;
  mask: ${WAVE} repeat-x left bottom / 6px 3px;
  pointer-events: none;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
.${cls()}[tabindex] { border-radius: 2px; }
/* Above the text and from its start, as in VS Code. Insets, because a position area that starts at text scrolled
   past the window edge never overflows, so the fallbacks would not run. */
.${cls('-popover')} {
  width: max-content;
  max-width: min(${cssVar('codeblocks.popoverMaxWidth')}, calc(100vw - 24px));
  margin: 6px 0;
  padding: 0.35rem 0.65rem;
  position-area: none;
  justify-self: auto;
  bottom: anchor(top);
  left: max(12px, anchor(left));
  position-try-fallbacks: flip-inline, flip-block, flip-block flip-inline;
  opacity: 0;
  user-select: text;
  -webkit-user-select: text;
  transition: opacity 120ms ease-out, display 120ms allow-discrete, overlay 120ms allow-discrete;
}
.${cls('-popover')}:popover-open { display: block; opacity: 1; }
@starting-style {
  .${cls('-popover')}:popover-open { opacity: 0; }
}
.${cls('-label')} { margin-inline-end: 0.5em; font-weight: 600; }
.${cls('-label')}::before {
  content: '';
  display: inline-block;
  width: 13px;
  height: 13px;
  margin-inline-end: 5px;
  vertical-align: -2px;
  background: var(--scb-squiggle);
  -webkit-mask: var(--scb-squiggle-icon) center / contain no-repeat;
  mask: var(--scb-squiggle-icon) center / contain no-repeat;
}
@media (forced-colors: active) {
  .${cls()}::after, .${cls('-label')}::before { forced-color-adjust: none; background: CanvasText; }
}
.${cls('-list')} { display: none; }
@media print {
  .${cls('-list')} {
    display: block;
    margin: 0;
    padding: 0.6rem 1rem 0.75rem 1.5rem;
    border-top: ${cssVar('borderWidth')} solid ${cssVar('borderColor')};
    font-size: 0.85em;
  }
}`,
    hooks: {
      annotateCode(context) {
        const { codeBlock } = context;
        const found = getDirectives(codeBlock).filter((d) => d.name in severities || d.name in aliases);
        if (found.length === 0) return;
        const data = squiggleData.getOrCreateFor(codeBlock);
        const uid = blockUid(context);
        for (const directive of found) {
          const line = directive.lines[0];
          if (!line) continue;
          const severity = aliases[directive.name] ?? (directive.name as Severity);
          // The notation plugin drops a directive whose `/text/` is not on its line.
          const { match } = directive;
          const start = match ? line.text.indexOf(match) : line.text.search(/\S/);
          if (start < 0) {
            warn(context, `\`[!${directive.name}]\` has no code to underline on its line.`, directive.sourceLine);
            continue;
          }
          const end = match ? start + match.length : line.text.trimEnd().length;
          const squiggle = { severity, text: inlineMarkdown(directive.text ?? ''), line };
          data.squiggles.push(squiggle);
          line.addAnnotation(
            new SquiggleAnnotation(squiggle, `--${cls()}-${uid}-${data.squiggles.length}`, {
              columnStart: start,
              columnEnd: end,
            }),
          );
        }
      },
      postprocessRenderedBlock({ codeBlock, renderData }) {
        const { squiggles } = squiggleData.getOrCreateFor(codeBlock);
        if (squiggles.length === 0) return;
        const figure = select('figure', renderData.blockAst);
        const pre = figure && select('pre', figure);
        if (!figure || !pre) return;
        pre.properties.dataScbSquiggles = '';
        // The popovers do not print, so their messages go in a list under the block.
        const items = squiggles.map(({ severity, text, line }) =>
          h('li', [
            `Line ${lineNumber(codeBlock, line)}, ${severities[severity].label.toLowerCase()}`,
            ...(text.length ? [': ', ...text] : []),
          ]),
        );
        figure.children.splice(figure.children.indexOf(pre) + 1, 0, h('ul', { class: cls('-list') }, items));
      },
    },
  };
}
