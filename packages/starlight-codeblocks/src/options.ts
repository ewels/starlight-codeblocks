import { nextflow } from './adapters/nextflow.ts';
import { python } from './adapters/python.ts';
import { type SwatchFormat, type SwatchShape, swatchFormats } from './expressive-code/swatches.ts';

export interface LineStateDefinition {
  label: string;
  colour: { dark: string; light: string };
}

export interface PlaygroundInput {
  code: string;
  lang: string;
  title?: string;
}

export interface PlaygroundDefinition {
  label: string;
  url?: (input: PlaygroundInput) => string;
  post?: (input: PlaygroundInput) => { action: string; fields: Record<string, string> };
}

/** What an API link adapter gets in `setup()`. */
export interface AdapterContext {
  /** The project root, as an absolute path. */
  root: string;
  /** Astro's cache folder, where integrations keep their data. */
  cacheDir: string;
  /**
   * Gets a URL and keeps the body on disk, so that later builds do not fetch it again.
   * Returns `null`, with a build warning, when the request fails and there is no copy on disk.
   * `check` throws for a body that is not usable, such as an HTML error page. That body is not kept, and its
   * error message completes the warning "<url> is …". With `quiet`, a failed request returns `null` with no warning.
   */
  fetch(url: string, check?: (body: Uint8Array) => void, options?: { quiet?: boolean }): Promise<Uint8Array | null>;
  /** Logs a build warning that names the adapter. */
  warn(message: string): void;
}

/** The link and the card text of a name in code. */
export interface Resolution {
  href: string;
  /** The qualified name, shown with `kind` when there is no signature. */
  name?: string;
  kind?: string;
  signature?: string;
  summary?: string;
  source: string;
  /**
   * A Simple Icons slug, such as `flask`, for the icon before the source on the card, or `false` for none.
   * By default, the plugin finds the icon from the project name at the start of `source`.
   */
  icon?: string | false;
}

/** A name in the code that `findSymbols` got, from index `start` up to `end`, with its link. */
export interface SymbolRef extends Resolution {
  start: number;
  end: number;
  name: string;
}

export interface ApiLinkAdapter {
  name: string;
  languages: string[];
  setup(context: AdapterContext): Promise<void>;
  /** `attributes` has the string attributes of the fence line, such as `title`. */
  findSymbols(code: string, language: string, attributes: Record<string, string>): SymbolRef[];
  /** Optional. A short summary for a name that `findSymbols` returned without one, for the card. */
  describe?(symbol: SymbolRef): Promise<string | undefined>;
}

export interface CodeblocksOptions {
  focus?: false | { style?: 'blur' | 'dim' };
  lineStates?: false | { states?: Record<string, LineStateDefinition>; prefix?: boolean };
  notation?: false | { comments?: Record<string, string[]> };
  callouts?: false;
  annotations?: false | { style?: 'filled' | 'outline' };
  footnotes?: false | { sticky?: boolean; style?: 'filled' | 'outline' };
  hiddenLines?: false;
  shellCopy?: false | { prompts?: string[] };
  wordDiff?: false | { minSimilarity?: number };
  whitespace?: false;
  brackets?: false | { languages?: string[] };
  swatches?:
    | false
    | {
        languages?: 'all' | string[];
        formats?: SwatchFormat[];
        shape?: SwatchShape;
        size?: string;
        hover?: boolean;
        copy?: boolean;
        prose?: boolean;
      };
  codeLinks?: false;
  apiLinks?: false | { adapters?: ApiLinkAdapter[] };
  expandable?: false | { lines?: number; auto?: number | false };
  playgrounds?: false | Record<string, PlaygroundDefinition>;
  mentions?: false;
  permalinks?: false;
  placeholders?: false | { storage?: 'local' | 'session' | 'none' };
  codeSwitcher?: false;
  walkthrough?: false;
  scrollycoding?: false;
  inlineHighlighting?: false | { defaultLanguage?: string | false };
  runnable?: false | { runtimes?: Record<string, string>; timeout?: number; label?: string; againLabel?: string };
}

/** The default export of a runtime module, which runs code for the Run button. */
export interface Runtime {
  /** Downloads and starts the runtime, and anything that `code` needs, such as its packages. Not timed. */
  load(code: string): Promise<void>;
  /** `session` is true when `code` is the commands of a session with prompts, which run as a REPL runs them. */
  run(code: string, options: { signal: AbortSignal; session?: boolean }): Promise<{ stdout: string; stderr: string }>;
}

type Settings<T> = Exclude<T, false | undefined>;

/** Options after validation: `false` for a feature that is off, its settings with defaults otherwise. */
export type ResolvedOptions = {
  [K in keyof CodeblocksOptions]-?: [Settings<CodeblocksOptions[K]>] extends [never]
    ? boolean
    : K extends 'playgrounds'
      ? false | Record<string, PlaygroundDefinition>
      : false | Required<Settings<CodeblocksOptions[K]>>;
};

interface Field {
  type: string;
  /** A function makes a fresh default for each call, for values that `structuredClone()` cannot copy. */
  default: unknown;
  /** Shown in the docs when the default value does not print well. */
  defaultText?: string;
  description: string;
  valid(value: unknown): boolean;
}

interface Feature {
  description: string;
  page: string;
  /** What stays behind when the option is `false`. */
  off?: string;
  fields?: Record<string, Field>;
  /** For options that are a map of names to definitions, such as `playgrounds`. */
  entries?: Omit<Field, 'default'>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown) => typeof value === 'string';
const isStringArray = (value: unknown) => Array.isArray(value) && value.every(isString);
const isRecordOf = (valid: (value: unknown) => boolean) => (value: unknown) =>
  isObject(value) && Object.values(value).every(valid);
const oneOf =
  (...values: string[]) =>
  (value: unknown) =>
    values.includes(value as string);

// Attributes and directives of other features, which a custom state name would clash with.
const reservedStateNames = new Set(
  'title frame mark ins del collapse wrap lang focus hidden hide highlight whitespace brackets swatches expandable playground id placeholder annotations footnotes label prefix step runnable note warn'.split(
    ' ',
  ),
);

const noteStyleField = (marks: string, fallback: 'filled' | 'outline', extra = ''): Field => ({
  type: "'filled' | 'outline'",
  default: fallback,
  description: `Filled ${marks} in the accent colour, or outlined ${marks} in the magenta of the theme.${extra} A code block can set its own on its fence line.`,
  valid: oneOf('filled', 'outline'),
});

/** Every option, with its type, default and description. The docs reference tables read this. */
export const optionsReference: Record<keyof CodeblocksOptions, Feature> = {
  focus: {
    description: 'Blurs the lines outside a focus range.',
    page: 'features/focus',
    off: '`[!code focus]` then stays in the code as written.',
    fields: {
      style: {
        type: "'blur' | 'dim'",
        default: 'blur',
        description:
          'Blur and fade the other lines, or only fade them. A code block can set its own on its fence line.',
        valid: oneOf('blur', 'dim'),
      },
    },
  },
  lineStates: {
    description: 'Tints lines as errors, warnings, notes or successes, with an optional message.',
    page: 'features/line-states',
    off: 'The directives then stay in the code as written.',
    fields: {
      states: {
        type: 'Record<string, { label: string; colour: { dark: string; light: string } }>',
        default: {},
        description:
          'Custom states by name, in addition to `error`, `warning`, `info` and `success`. A name uses lower-case letters, digits and hyphens.',
        valid: (value) =>
          isRecordOf(
            (state) =>
              isObject(state) &&
              isString(state.label) &&
              isObject(state.colour) &&
              isString(state.colour.dark) &&
              isString(state.colour.light),
          )(value) &&
          Object.keys(value as object).every((name) => /^[a-z][a-z0-9-]*$/.test(name) && !reservedStateNames.has(name)),
      },
      prefix: {
        type: 'boolean',
        default: true,
        description:
          'Show the name of the state, such as **Error**, before each message, and on the first line of a run with no message. Off, the tint alone marks the state on screen. A code block can set its own on its fence line.',
        valid: (value) => typeof value === 'boolean',
      },
    },
  },
  notation: {
    description: 'Reads directives in code comments.',
    page: 'comment-notation',
    off: 'Every comment then renders as written.',
    fields: {
      comments: {
        type: 'Record<string, string[]>',
        default: {},
        description: 'Comment syntax for each language, added to the built-in map. An empty list removes a language.',
        valid: isRecordOf(isStringArray),
      },
    },
  },
  callouts: { description: 'Shows a note in a bubble above a line.', page: 'features/inline-callouts' },
  annotations: {
    description: 'Adds numbered markers that open a note.',
    page: 'features/annotations',
    fields: {
      style: noteStyleField('markers', 'filled', ' Side annotations use it too.'),
    },
  },
  footnotes: {
    description: 'Adds numbered badges to lines, with the notes in a list under the block.',
    page: 'features/footnotes',
    fields: {
      sticky: {
        type: 'boolean',
        default: false,
        description:
          'Keep the list of footnotes in view while the block is on screen. A code block can set its own on its fence line.',
        valid: (value) => typeof value === 'boolean',
      },
      style: noteStyleField('badges', 'outline'),
    },
  },
  hiddenLines: {
    description: 'Hides lines that readers need to run the code but not to understand it.',
    page: 'features/hidden-lines',
  },
  shellCopy: {
    description: 'Adds a Copy commands button to terminal blocks with prompts, which copies the commands only.',
    page: 'features/smart-shell-copy',
    fields: {
      prompts: {
        type: 'string[]',
        default: ['$ ', '> '],
        description: 'Line starts that mark a command. A code block can set its own on its fence line.',
        valid: isStringArray,
      },
    },
  },
  wordDiff: {
    description: 'Highlights the words that changed between a removed line and an added line.',
    page: 'features/word-level-diff',
    fields: {
      minSimilarity: {
        type: 'number',
        default: 0.4,
        description:
          'Pairs of lines less similar than this keep whole-line tints only. From 0 to 1. A code block can set its own on its fence line.',
        valid: (value) => typeof value === 'number' && value >= 0 && value <= 1,
      },
    },
  },
  whitespace: { description: 'Shows spaces and tabs as faint glyphs.', page: 'features/visible-whitespace' },
  brackets: {
    description: 'Colours matching brackets by nesting depth.',
    page: 'features/colourised-brackets',
    fields: {
      languages: {
        type: 'string[]',
        default: [],
        description: 'Languages that get colourised brackets in every block.',
        valid: isStringArray,
      },
    },
  },
  swatches: {
    description: 'Shows a swatch of the colour before each CSS colour in code.',
    page: 'features/colour-swatches',
    fields: {
      languages: {
        type: "'all' | string[]",
        default: 'all',
        description:
          'Languages that get swatches. `swatches` on the fence line turns them on for one block of another language.',
        valid: (value) => value === 'all' || isStringArray(value),
      },
      formats: {
        type: `Array<${swatchFormats.map((format) => `'${format}'`).join(' | ')}>`,
        default: [...swatchFormats],
        description:
          'The kinds of colour that get swatches. `rgb` also covers `rgba()`, and `hsl` covers `hsla()`. `named` is the CSS colour names, such as `rebeccapurple`.',
        valid: (value) =>
          Array.isArray(value) && value.every((format) => swatchFormats.includes(format as SwatchFormat)),
      },
      shape: {
        type: "'square' | 'rounded' | 'circle'",
        default: 'rounded',
        description: 'The shape of each swatch.',
        valid: oneOf('square', 'rounded', 'circle'),
      },
      size: {
        type: 'string',
        default: '0.8em',
        description: 'The width and height of each swatch, as a CSS length such as `10px` or `0.8em`.',
        valid: (value) => isString(value) && /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|ch|ex|lh)$/.test(value),
      },
      hover: {
        type: 'boolean',
        default: true,
        description: 'Tint the colour text in its own colour, and enlarge the swatch, when the mouse cursor is on it.',
        valid: (value) => typeof value === 'boolean',
      },
      copy: {
        type: 'boolean',
        default: true,
        description: 'Copy the colour when the reader clicks it.',
        valid: (value) => typeof value === 'boolean',
      },
      prose: {
        type: 'boolean',
        default: false,
        description:
          'Also show swatches in the text of Markdown pages, and in inline code that is one colour. Named colours get a swatch only in inline code.',
        valid: (value) => typeof value === 'boolean',
      },
    },
  },
  codeLinks: { description: 'Turns text on a line into a link.', page: 'features/code-links' },
  apiLinks: {
    description: 'Links names in code to their reference pages.',
    page: 'features/api-auto-linking',
    fields: {
      adapters: {
        type: 'ApiLinkAdapter[]',
        default: () => [python(), nextflow()],
        defaultText: '`[python(), nextflow()]`',
        description: 'Adapters that find and resolve names.',
        valid: (value) =>
          Array.isArray(value) &&
          value.every(
            (adapter) =>
              isObject(adapter) &&
              isString(adapter.name) &&
              isStringArray(adapter.languages) &&
              typeof adapter.setup === 'function' &&
              typeof adapter.findSymbols === 'function',
          ),
      },
    },
  },
  expandable: {
    description: 'Shows the first lines of long blocks, with a button to show the rest.',
    page: 'features/expandable-blocks',
    off: '`expandable` and `expandable={N}` then have no effect.',
    fields: {
      lines: {
        type: 'number',
        default: 12,
        description: 'Lines to show before the block expands. A code block can set its own on its fence line.',
        valid: (value) => Number.isInteger(value) && (value as number) > 0,
      },
      auto: {
        type: 'number | false',
        default: false,
        description:
          'Makes every block with more lines than this expandable, without the attribute. `expandable=false` turns it off for one block.',
        valid: (value) => value === false || (Number.isInteger(value) && (value as number) > 0),
      },
    },
  },
  playgrounds: {
    description: 'Adds a button that opens the code in an online playground.',
    page: 'features/open-in-playground',
    off: '`playground` attributes then have no effect.',
    entries: {
      type: 'an object with a `label` and one of `url` or `post`',
      description: 'Custom playgrounds by name, in addition to the built-in ones.',
      valid: (value) =>
        isObject(value) &&
        isString(value.label) &&
        (typeof value.url === 'function') !== (typeof value.post === 'function'),
    },
  },
  mentions: {
    description: 'Highlights lines when the reader hovers over a link in the prose.',
    page: 'features/code-mentions',
  },
  permalinks: { description: 'Turns line numbers into links to each line.', page: 'features/line-permalinks' },
  placeholders: {
    description: 'Turns placeholder text into input fields.',
    page: 'features/fill-in-placeholders',
    fields: {
      storage: {
        type: "'local' | 'session' | 'none'",
        default: 'local',
        description:
          'Where the browser keeps the values that readers type. A code block can set its own on its fence line.',
        valid: oneOf('local', 'session', 'none'),
      },
    },
  },
  codeSwitcher: {
    description: 'Combines several variants of a block, with a menu in the title bar.',
    page: 'features/code-switcher',
  },
  walkthrough: {
    description: 'Animates the code between the steps of a `<CodeWalkthrough>` component.',
    page: 'features/code-walkthrough',
    off: '`<CodeWalkthrough>` then shows each step as a separate block, with its label after the title, and loads no script.',
  },
  scrollycoding: {
    description: 'Changes the focus of a sticky block as the prose steps scroll past.',
    page: 'features/scrollycoding',
  },
  inlineHighlighting: {
    description: 'Adds syntax colours to inline code with a `{:lang}` suffix.',
    page: 'features/inline-code-highlighting',
    fields: {
      defaultLanguage: {
        type: 'string | false',
        default: false,
        description: 'The language of inline code with no suffix. `{:txt}` keeps one piece of inline code plain.',
        valid: (value) => value === false || (isString(value) && /^[\w#+-][\w#+.-]*$/.test(value)),
      },
    },
  },
  runnable: {
    description: 'Adds a button that runs the code in the browser.',
    page: 'features/run-in-the-browser',
    off: '`runnable` attributes then have no effect.',
    fields: {
      runtimes: {
        type: 'Record<string, string>',
        default: {},
        defaultText: "`{ python: 'starlight-codeblocks/runtimes/pyodide' }`",
        description:
          'Runtime modules by language: a package path, or a path from the project root. The site entries are added to the built-in Python runtime, or replace it.',
        valid: isRecordOf(isString),
      },
      timeout: {
        type: 'number',
        default: 10000,
        description:
          'Milliseconds before a run stops, from 1 to 2147483647, the largest delay browsers accept. A code block can set its own on its fence line.',
        valid: (value) => typeof value === 'number' && value > 0 && value <= 2 ** 31 - 1,
      },
      label: {
        type: 'string',
        default: 'Run in browser',
        description: 'The text of the button. A code block can set its own on its fence line.',
        valid: (value) => isString(value) && value.trim() !== '',
      },
      againLabel: {
        type: 'string',
        default: 'Run again',
        description: 'The text of the button after the first run. A code block can set its own on its fence line.',
        valid: (value) => isString(value) && value.trim() !== '',
      },
    },
  },
};

export class OptionsError extends Error {
  constructor(message: string) {
    super(`starlight-codeblocks: ${message}`);
    this.name = 'OptionsError';
  }
}

const show = (value: unknown) =>
  typeof value === 'function' ? 'a function' : (JSON.stringify(value) ?? String(value));

/** Validates options and fills in the defaults. Throws an `OptionsError` for unknown keys or wrong types. */
export function resolveOptions(options: CodeblocksOptions = {}): ResolvedOptions {
  if (!isObject(options)) throw new OptionsError(`expected an options object, got ${show(options)}.`);
  const known = Object.keys(optionsReference);
  for (const key of Object.keys(options)) {
    if (!(key in optionsReference)) {
      throw new OptionsError(`unknown option \`${key}\`. Known options: ${known.join(', ')}.`);
    }
  }
  const resolved: Record<string, unknown> = {};
  for (const [key, feature] of Object.entries(optionsReference)) {
    const value = (options as Record<string, unknown>)[key];
    if (value === false) {
      resolved[key] = false;
      continue;
    }
    if (!feature.fields && !feature.entries) {
      if (value !== undefined) throw new OptionsError(`\`${key}\` must be \`false\` or left out, got ${show(value)}.`);
      resolved[key] = true;
      continue;
    }
    if (value !== undefined && !isObject(value)) {
      throw new OptionsError(`\`${key}\` must be \`false\` or an object, got ${show(value)}.`);
    }
    resolved[key] = feature.entries
      ? resolveEntries(key, feature.entries, value ?? {})
      : resolveFields(key, feature.fields ?? {}, value ?? {});
  }
  return resolved as ResolvedOptions;
}

function resolveFields(key: string, fields: Record<string, Field>, value: Record<string, unknown>) {
  for (const name of Object.keys(value)) {
    if (!(name in fields)) {
      throw new OptionsError(
        `unknown option \`${key}.${name}\`. Known options for \`${key}\`: ${Object.keys(fields).join(', ')}.`,
      );
    }
  }
  const result: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(fields)) {
    const given = value[name];
    if (given !== undefined && !field.valid(given)) {
      throw new OptionsError(`\`${key}.${name}\` must be ${field.type}, got ${show(given)}.`);
    }
    result[name] = given ?? (typeof field.default === 'function' ? field.default() : structuredClone(field.default));
  }
  return result;
}

function resolveEntries(key: string, entries: Omit<Field, 'default'>, value: Record<string, unknown>) {
  for (const [name, entry] of Object.entries(value)) {
    if (!entries.valid(entry)) {
      throw new OptionsError(`\`${key}.${name}\` must be ${entries.type}, got ${show(entry)}.`);
    }
  }
  return { ...value };
}
