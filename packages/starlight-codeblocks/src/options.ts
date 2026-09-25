import { python } from './adapters/python.ts';

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
  /** Astro's cache folder, where other integrations, such as starlight-pydocs, keep their data. */
  cacheDir: string;
  /**
   * Gets a URL and keeps the body on disk, so that later builds do not fetch it again.
   * Returns `null`, with a build warning, when the request fails and there is no copy on disk.
   */
  fetch(url: string): Promise<Uint8Array | null>;
  /** Logs a build warning that names the adapter. */
  warn(message: string): void;
}

export interface SymbolRef {
  start: number;
  end: number;
  name: string;
  context?: unknown;
}

export interface Resolution {
  href: string;
  /** The qualified name, shown with `kind` when there is no signature. The default is the symbol's name. */
  name?: string;
  kind?: string;
  signature?: string;
  summary?: string;
  source: string;
}

export interface ApiLinkAdapter {
  name: string;
  languages: string[];
  setup(context: AdapterContext): Promise<void>;
  findSymbols(code: string, language: string): SymbolRef[];
  resolve(symbol: SymbolRef): Resolution | null;
}

export interface CodeblocksOptions {
  focus?: false | { style?: 'blur' | 'dim' };
  lineStates?: false | { states?: Record<string, LineStateDefinition> };
  notation?: false | { comments?: Record<string, string[]> };
  callouts?: false;
  annotations?: false;
  footnotes?: false | { sticky?: boolean };
  hiddenLines?: false;
  shellCopy?: false | { prompts?: string[] };
  wordDiff?: false | { minSimilarity?: number };
  whitespace?: false;
  brackets?: false | { languages?: string[] };
  tokenLinks?: false;
  apiLinks?: false | { adapters?: ApiLinkAdapter[] };
  expandable?: false | { lines?: number };
  playgrounds?: false | Record<string, PlaygroundDefinition>;
  mentions?: false;
  permalinks?: false;
  placeholders?: false | { storage?: 'local' | 'session' | 'none' };
  codeSwitcher?: false;
  transitions?: false;
  scrollycoding?: false;
  inlineHighlighting?: false;
  runnable?: false | { runtimes?: Record<string, string>; timeout?: number };
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
  'title frame mark ins del collapse wrap lang focus hidden hide highlight whitespace brackets expandable playground id placeholder annotations footnotes label step runnable'.split(
    ' ',
  ),
);

/** Every option, with its type, default and description. The docs reference tables read this. */
export const optionsReference: Record<keyof CodeblocksOptions, Feature> = {
  focus: {
    description: 'Blurs the lines outside a focus range.',
    fields: {
      style: {
        type: "'blur' | 'dim'",
        default: 'blur',
        description: 'Blur and fade the other lines, or only fade them.',
        valid: oneOf('blur', 'dim'),
      },
    },
  },
  lineStates: {
    description: 'Tints lines as errors, warnings or notes, with an optional message.',
    fields: {
      states: {
        type: 'Record<string, { label: string; colour: { dark: string; light: string } }>',
        default: {},
        description:
          'Custom states by name, in addition to `error`, `warning` and `info`. A name uses lower-case letters, digits and hyphens.',
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
    },
  },
  notation: {
    description: 'Reads directives in code comments.',
    fields: {
      comments: {
        type: 'Record<string, string[]>',
        default: {},
        description: 'Comment syntax for each language, added to the built-in map. An empty list removes a language.',
        valid: isRecordOf(isStringArray),
      },
    },
  },
  callouts: { description: 'Shows a note in a bubble above a line.' },
  annotations: { description: 'Adds numbered markers that open a note.' },
  footnotes: {
    description: 'Adds numbered badges to lines, with the notes in a list under the block.',
    fields: {
      sticky: {
        type: 'boolean',
        default: false,
        description: 'Keep the list of footnotes in view while the block is on screen.',
        valid: (value) => typeof value === 'boolean',
      },
    },
  },
  hiddenLines: { description: 'Hides lines that readers need to run the code but not to understand it.' },
  shellCopy: {
    description: 'Copies only the commands from terminal blocks with prompts.',
    fields: {
      prompts: {
        type: 'string[]',
        default: ['$ ', '> '],
        description: 'Line starts that mark a command.',
        valid: isStringArray,
      },
    },
  },
  wordDiff: {
    description: 'Highlights the words that changed between a removed line and an added line.',
    fields: {
      minSimilarity: {
        type: 'number',
        default: 0.4,
        description: 'Pairs of lines less similar than this keep whole-line tints only. From 0 to 1.',
        valid: (value) => typeof value === 'number' && value >= 0 && value <= 1,
      },
    },
  },
  whitespace: { description: 'Shows spaces and tabs as faint glyphs.' },
  brackets: {
    description: 'Colours matching brackets by nesting depth.',
    fields: {
      languages: {
        type: 'string[]',
        default: [],
        description: 'Languages that get colourised brackets in every block.',
        valid: isStringArray,
      },
    },
  },
  tokenLinks: { description: 'Turns text on a line into a link.' },
  apiLinks: {
    description: 'Links names in code to their reference pages.',
    fields: {
      adapters: {
        type: 'ApiLinkAdapter[]',
        default: () => [python()],
        defaultText: '`[python()]`',
        description: 'Adapters that find and resolve names.',
        valid: (value) => Array.isArray(value) && value.every((adapter) => isObject(adapter) && isString(adapter.name)),
      },
    },
  },
  expandable: {
    description: 'Shows the first lines of long blocks, with a button to show the rest.',
    fields: {
      lines: {
        type: 'number',
        default: 12,
        description: 'Lines to show before the block expands.',
        valid: (value) => Number.isInteger(value) && (value as number) > 0,
      },
    },
  },
  playgrounds: {
    description: 'Adds a button that opens the code in an online playground.',
    entries: {
      type: 'an object with a `label` and one of `url` or `post`',
      description: 'Custom playgrounds by name, in addition to the built-in ones.',
      valid: (value) =>
        isObject(value) &&
        isString(value.label) &&
        (typeof value.url === 'function') !== (typeof value.post === 'function'),
    },
  },
  mentions: { description: 'Highlights lines when the reader hovers over a link in the prose.' },
  permalinks: { description: 'Turns line numbers into links to each line.' },
  placeholders: {
    description: 'Turns placeholder text into input fields.',
    fields: {
      storage: {
        type: "'local' | 'session' | 'none'",
        default: 'local',
        description: 'Where the browser keeps the values that readers type.',
        valid: oneOf('local', 'session', 'none'),
      },
    },
  },
  codeSwitcher: { description: 'Combines several variants of a block, with a menu in the title bar.' },
  transitions: { description: 'Animates the code between the steps of a `<CodeSteps>` component.' },
  scrollycoding: { description: 'Changes the focus of a sticky block as the prose steps scroll past.' },
  inlineHighlighting: { description: 'Adds syntax colours to inline code with a `{:lang}` suffix.' },
  runnable: {
    description: 'Adds a Run button that runs the code in the browser.',
    fields: {
      runtimes: {
        type: 'Record<string, string>',
        default: {},
        description: 'Runtime modules by language.',
        valid: isRecordOf(isString),
      },
      timeout: {
        type: 'number',
        default: 10000,
        description: 'Milliseconds before a run stops.',
        valid: (value) => typeof value === 'number' && value > 0,
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
