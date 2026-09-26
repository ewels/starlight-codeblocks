import type { CodeblocksPlugin } from '../../../packages/starlight-codeblocks/src/expressive-code/core.ts';
import { createPlugins } from '../../../packages/starlight-codeblocks/src/expressive-code/index.ts';
import { optionsReference, resolveOptions } from '../../../packages/starlight-codeblocks/src/options.ts';
import { attributesReference, styleSettingsReference } from '../../../packages/starlight-codeblocks/src/reference.ts';

const plugins = createPlugins(resolveOptions()) as CodeblocksPlugin[];
const words: Record<string, string> = { '++': 'insert', '--': 'delete' };

/** Every directive with its docs, for the directives reference page and its table of contents. */
export const directives = plugins.flatMap((plugin) =>
  Object.entries(plugin.directives ?? {}).flatMap(([name, { placement, docs }]) =>
    docs
      ? [
          {
            id: name.replace(/\S+/g, (word) => words[word] ?? word).replace(/ /g, '-'),
            label: `[!${name}]`,
            placement,
            docs,
          },
        ]
      : [],
  ),
);

export const attributes = attributesReference.map((attribute) => ({
  ...attribute,
  id: attribute.name === '<state>' ? 'custom-state' : attribute.name.toLowerCase(),
}));

/** Each style settings group with its default values, in the order of the plugins. */
export const styleGroups = plugins.flatMap((plugin) =>
  Object.entries((plugin.styleSettings?.defaultValues ?? {}) as Record<string, Record<string, unknown>>).map(
    ([name, defaults]) => ({ name, defaults, ...styleSettingsReference[name] }),
  ),
);

export interface OptionEntry {
  id: string;
  label: string;
  /** Code in backticks, for `inlineCode()`. */
  type: string;
  default: string;
  description: string;
  page: string;
}

const code = (text: string) => (text.includes('`') ? text : `\`${text}\``);
const show = (value: unknown) => code(JSON.stringify(value).replaceAll('"', "'"));
const optionId = (label: string) => label.toLowerCase().replaceAll('.', '-').replace(/[<>]/g, '');

/** Every option of `codeblocks()`, in the order of the options object. */
export const options: OptionEntry[] = Object.entries(optionsReference).flatMap(([key, feature]) => {
  const settings = !!(feature.fields || feature.entries);
  return [
    {
      id: optionId(key),
      label: key,
      type: code(settings ? 'false | object' : 'false'),
      default: 'On',
      description: `${feature.description} Set it to \`false\` to turn the feature off.${feature.off ? ` ${feature.off}` : ''}`,
      page: feature.page,
    },
    ...Object.entries(feature.fields ?? {}).map(([field, spec]) => ({
      id: optionId(`${key}.${field}`),
      label: `${key}.${field}`,
      type: code(spec.type),
      default: spec.defaultText ?? show(typeof spec.default === 'function' ? spec.default() : spec.default),
      description: spec.description,
      page: feature.page,
    })),
    ...(feature.entries
      ? [
          {
            id: optionId(`${key}.<name>`),
            label: `${key}.<name>`,
            type: code(feature.entries.type),
            default: 'None',
            description: feature.entries.description,
            page: feature.page,
          },
        ]
      : []),
  ];
});

const apiLinks = 'features/api-auto-linking';

/** The options of the built-in adapters for API auto-linking. */
export const adapterOptions: Record<'python' | 'nextflow', OptionEntry[]> = {
  python: [
    {
      id: 'python-stdlib',
      label: 'stdlib',
      type: '`boolean`',
      default: '`true`',
      description: 'Link names from the Python standard library, through `https://docs.python.org/3/objects.inv`.',
      page: apiLinks,
    },
    {
      id: 'python-inventories',
      label: 'inventories',
      type: '`(string | { url: string; base?: string })[]`',
      default: '`[]`',
      description:
        'More Sphinx `objects.inv` files. `base` is the URL that relative links start from, if it is not the folder of `url`.',
      page: apiLinks,
    },
    {
      id: 'python-pydocs',
      label: 'pydocs',
      type: '`{ package: string; base?: string; dump?: string }[]`',
      default: '`[]`',
      description: 'Packages that the site documents with starlight-pydocs.',
      page: apiLinks,
    },
  ],
  nextflow: [
    {
      id: 'nextflow-modules',
      label: 'modules',
      type: '`({ name, path }) => string | object | undefined`',
      default: 'None',
      description: 'The reference page of an included process or workflow.',
      page: apiLinks,
    },
  ],
};

/** The options that `<Options>` shows on a feature page: none for a feature without settings. */
export function pageOptions(page: string) {
  const own = options.filter((option) => option.page === page);
  return own.some((option) => option.label.includes('.')) ? own : [];
}

type Heading = { depth: number; slug: string; text: string };
const optionHeading = (depth: number) => (option: OptionEntry) => ({ depth, slug: option.id, text: option.label });

/**
 * Headings that components write, so Starlight does not see them, by docs entry and then by the
 * slug of the heading they go under (an empty slug for the top level).
 */
export const componentHeadings: Record<string, Record<string, Heading[]>> = {
  'reference/directives': { '': directives.map(({ id, label }) => ({ depth: 2, slug: id, text: label })) },
  'reference/attributes': { '': attributes.map(({ id, syntax }) => ({ depth: 2, slug: id, text: syntax.join(', ') })) },
  'reference/style-settings': {
    '': styleGroups.map(({ name }) => ({ depth: 2, slug: name.toLowerCase(), text: name })),
  },
  'reference/options': { '': options.map(optionHeading(2)) },
  [apiLinks]: {
    'python-adapter': adapterOptions.python.map(optionHeading(3)),
    'nextflow-adapter': adapterOptions.nextflow.map(optionHeading(3)),
  },
};

for (const page of new Set(options.map((option) => option.page))) {
  const own = pageOptions(page);
  if (own.length > 0) componentHeadings[page] = { ...componentHeadings[page], options: own.map(optionHeading(3)) };
}
