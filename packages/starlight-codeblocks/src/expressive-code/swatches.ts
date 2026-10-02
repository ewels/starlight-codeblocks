import { type AnnotationRenderOptions, ExpressiveCodeAnnotation } from '@expressive-code/core';
import { h, select } from '@expressive-code/core/hast';
import { clientJsModules } from '../client-modules.ts';
import { type CodeblocksPlugin, languageId } from './core.ts';
import { PREFIX } from './styles.ts';

export const swatchFormats = ['hex', 'rgb', 'hsl', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color', 'named'] as const;
export type SwatchFormat = (typeof swatchFormats)[number];
export type SwatchShape = 'square' | 'rounded' | 'circle';

export interface SwatchSettings {
  languages: 'all' | string[];
  formats: SwatchFormat[];
  shape: SwatchShape;
  size: string;
  hover: boolean;
  copy: boolean;
  prose: boolean;
}

/**
 * Where the text comes from. A `stylesheet` matches every colour in a declaration value. Other `code` matches
 * colours only where they look like values. `prose` also skips hex that reads as an issue number or a word.
 */
export type SwatchContext = 'stylesheet' | 'code' | 'prose';

const stylesheetLanguages = new Set(['css', 'scss', 'sass', 'less', 'stylus', 'postcss']);

const named =
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen';
const namedColours = new Set(named.split(' '));

const NUM = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(?:%|deg|grad|rad|turn)?|none`;
const SEP = String.raw`(?:\s*,\s*|\s+)`;
const ALPHA = String.raw`(?:\s*[,/]\s*(?:${NUM}))?`;
const ARGS = String.raw`\(\s*(?:${NUM})${SEP}(?:${NUM})${SEP}(?:${NUM})${ALPHA}\s*\)`;
const SPACES = 'srgb|srgb-linear|display-p3|a98-rgb|prophoto-rgb|rec2020|xyz|xyz-d50|xyz-d65';
const COLOR_ARGS = String.raw`\(\s*(?:${SPACES})\s+(?:${NUM})\s+(?:${NUM})\s+(?:${NUM})(?:\s*/\s*(?:${NUM}))?\s*\)`;

// One pass over the text: hex, colour functions with literal numbers only (no `var()` or `calc()`), and words.
const PATTERN = new RegExp(
  String.raw`#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{3,4})(?![\w-])|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)${ARGS}|\bcolor${COLOR_ARGS}|\b[a-z]+\b`,
  'gi',
);

const formatOf = (match: string): SwatchFormat => {
  if (match.startsWith('#')) return 'hex';
  const fn = match.match(/^([a-z]+)\(/i)?.[1]?.toLowerCase();
  if (!fn) return 'named';
  return fn.replace(/a$/, '') as SwatchFormat;
};

export interface ColourMatch {
  start: number;
  end: number;
  colour: string;
}

const QUOTES = `'"\``;

/** Finds CSS colours in one line of `text`. See `SwatchContext` for how careful each context is. */
export function findColours(text: string, context: SwatchContext, formats: readonly SwatchFormat[]): ColourMatch[] {
  const matches: ColourMatch[] = [];
  for (const match of text.matchAll(PATTERN)) {
    const colour = match[0];
    const start = match.index;
    const end = start + colour.length;
    const format = formatOf(colour);
    if (format === 'named' && !namedColours.has(colour.toLowerCase())) continue;
    if (!formats.includes(format)) continue;
    const before = text.slice(0, start);
    const prev = before.at(-1) ?? '';
    const next = text[end] ?? '';
    // A class, Sass or Less variable, custom property, path, attribute or HTML entity, such as `.red` or `&#123`.
    if (/[\w$@.&/\\-]/.test(prev) || (format !== 'hex' && prev === '#')) continue;
    // An SVG fragment, such as `url(#fade)`.
    if (/url\(\s*['"]?$/i.test(before)) continue;
    const quoted = QUOTES.includes(prev) && next === prev;
    if (format === 'hex' && !keepHex(colour, context, quoted, before, text.slice(end))) continue;
    if (format === 'named' && !keepNamed(context, quoted, before, text.slice(end))) continue;
    if (format !== 'hex' && format !== 'named' && context === 'code' && !looksLikeValue(prev, before)) continue;
    matches.push({ start, end, colour });
  }
  return matches;
}

/** After a quote, a bracket, or a `:`, `=` or `,`, as in `color: #fff` or `fill="#fff"`. */
const looksLikeValue = (prev: string, before: string) => /['"`([]/.test(prev) || /[:=,(]\s*$/.test(before);

function keepHex(colour: string, context: SwatchContext, quoted: boolean, before: string, after: string) {
  const digits = colour.slice(1);
  const onlyDigits = /^\d+$/.test(digits);
  // `#123` and `#1234` are issue and pull request numbers.
  if (onlyDigits && digits.length <= 4 && !quoted) return context === 'stylesheet';
  if (context === 'stylesheet') return !/^[^;()]*\{/.test(after);
  // Not `// TODO #add`, which a comment can hold in any language.
  if (context === 'code')
    return quoted || (looksLikeValue(before.at(-1) ?? '', before) && /^\s*([,;)}\]]|$)/.test(after));
  // In prose, `#add`, `#cafe` and `#123456` are tags or numbers more often than colours.
  return quoted || (!onlyDigits && (digits.length >= 6 || /\d/.test(digits)));
}

function keepNamed(context: SwatchContext, quoted: boolean, before: string, after: string) {
  if (context === 'stylesheet') {
    // Inside a declaration value, not a selector such as `a:hover red {`.
    const declaration = before.slice(Math.max(before.lastIndexOf('{'), before.lastIndexOf(';')) + 1);
    return declaration.includes(':') && !/^[^;]*\{/.test(after);
  }
  return context === 'code' && quoted;
}

/** The context for a code block of `language`. */
export const blockContext = (language: string): SwatchContext =>
  stylesheetLanguages.has(languageId(language)) ? 'stylesheet' : 'code';

/** A whole piece of inline code that is one colour, such as `` `#ff5f1f` `` or `` `rgb(0 0 0 / 50%)` ``. */
export function wholeColour(text: string, formats: readonly SwatchFormat[]) {
  const trimmed = text.trim();
  // As a declaration value, where named colours count.
  if (/^#\d{3,4}$/.test(trimmed)) return undefined;
  const [match] = findColours(`a: ${trimmed}`, 'stylesheet', formats);
  return match?.start === 3 && match.end === trimmed.length + 3 ? trimmed : undefined;
}

export const SWATCH = `${PREFIX}-swatch`;
const SHAPES: Record<SwatchShape, string> = { square: '1px', rounded: '25%', circle: '50%' };

/** The hast properties of the element around a colour. The client module reads `data-scb-colour`. */
export const swatchProperties = (colour: string) => ({
  class: `${SWATCH}-text`,
  dataScbColour: colour,
  style: `--${PREFIX}-swatch: ${colour}`,
});

/** The swatch before the colour, which copies no text. */
export const swatchElement = () => h('span', { class: SWATCH, ariaHidden: 'true' });

/** Styles for swatches in code blocks and in prose. `tip` colours the **Copied** label. */
export function swatchStyles(
  { shape, size, hover }: Pick<SwatchSettings, 'shape' | 'size' | 'hover'>,
  tip: { bg: string; fg: string },
) {
  return `.${SWATCH}-text { border-radius: 3px; transition: background-color 150ms ease-out; }
.${SWATCH} {
  display: inline-block;
  box-sizing: border-box;
  width: ${size};
  height: ${size};
  margin-inline-end: 0.25em;
  vertical-align: -0.1em;
  border-radius: ${SHAPES[shape]};
  /* A checkerboard shows through colours with transparency. */
  background: linear-gradient(var(--${PREFIX}-swatch), var(--${PREFIX}-swatch)), repeating-conic-gradient(#808080 0 25%, transparent 0 50%) 0 0 / 50% 50%;
  box-shadow: 0 0 0 1px color-mix(in srgb, currentColor 45%, transparent);
  user-select: none;
  transition: transform 150ms ease-out;
}${
    hover
      ? `
.${SWATCH}-text:is(:hover, :focus-visible) { background-color: color-mix(in srgb, var(--${PREFIX}-swatch) 22%, transparent); }
.${SWATCH}-text:is(:hover, :focus-visible) > .${SWATCH} { transform: scale(1.2); }`
      : ''
  }
/* The client module makes each colour a button. */
.${SWATCH}-text[role='button'] { cursor: copy; }
.${SWATCH}-text[data-scb-copied] { position: relative; }
.${SWATCH}-text[data-scb-copied]::after {
  content: attr(data-scb-copied);
  /* Beside the colour, not above it: a code block clips anything above its first line. */
  position: absolute;
  inset-block-start: 50%;
  inset-inline-start: calc(100% + 6px);
  translate: 0 -50%;
  z-index: 1;
  padding: 1px 6px;
  border-radius: 4px;
  background: ${tip.bg};
  color: ${tip.fg};
  box-shadow: 0 0 0 1px color-mix(in srgb, ${tip.fg} 25%, transparent);
  font-size: 0.75rem;
  line-height: 1.5;
  white-space: nowrap;
  pointer-events: none;
}`;
}

export const SWATCH_CSS_ID = 'virtual:starlight-codeblocks/swatches.css';

/** Styles for swatches in prose, with Starlight's colours for the **Copied** label. Block styles outweigh them in code blocks. */
export const proseSwatchStyles = (settings: SwatchSettings) =>
  swatchStyles(settings, { bg: 'var(--sl-color-gray-6)', fg: 'var(--sl-color-white)' });

class SwatchAnnotation extends ExpressiveCodeAnnotation {
  constructor(
    private readonly colour: string,
    inlineRange: { columnStart: number; columnEnd: number },
  ) {
    // After brackets, which then sit inside the colour, and before text markers, which can split it.
    super({ inlineRange, renderPhase: 'earlier' });
  }
  render({ nodesToTransform }: AnnotationRenderOptions) {
    return nodesToTransform.map((node, i) =>
      h('span', swatchProperties(this.colour), i === 0 ? [swatchElement(), node] : [node]),
    );
  }
}

/** Shows a swatch before each CSS colour in code. `swatches=false` turns it off for one block. */
export function pluginSwatches(settings: SwatchSettings): CodeblocksPlugin {
  const ids = settings.languages === 'all' ? undefined : new Set(settings.languages.map(languageId));
  return {
    name: 'starlight-codeblocks:swatches',
    baseStyles: ({ cssVar }) =>
      swatchStyles(settings, {
        bg: cssVar('codeblocks.popoverBackground'),
        fg: cssVar('codeblocks.popoverForeground'),
      }),
    ...(settings.copy && { jsModules: clientJsModules }),
    hooks: {
      annotateCode({ codeBlock }) {
        const on = codeBlock.metaOptions.getBoolean('swatches') ?? (!ids || ids.has(languageId(codeBlock.language)));
        if (!on) return;
        const context = blockContext(codeBlock.language);
        for (const line of codeBlock.getLines()) {
          for (const { start, end, colour } of findColours(line.text, context, settings.formats)) {
            line.addAnnotation(new SwatchAnnotation(colour, { columnStart: start, columnEnd: end }));
          }
        }
      },
      postprocessRenderedBlock({ renderData }) {
        const pre = select('pre', renderData.blockAst);
        if (settings.copy && pre && select(`.${SWATCH}-text`, pre)) pre.properties.dataScbSwatches = '';
      },
    },
  };
}
