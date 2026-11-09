#!/usr/bin/env node
// Rebuilds the Nextflow adapter's reference data (directives, qualifiers, config scopes and settings, the standard
// library and its types) from a nextflow-io/nextflow checkout, and checks every link against the live pages:
// `node scripts/nextflow-reference.mjs <checkout>`.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const checkout = process.argv[2];
if (!checkout) {
  console.error('Usage: node scripts/nextflow-reference.mjs <path to a nextflow-io/nextflow checkout>');
  process.exit(1);
}
const root = fileURLToPath(new URL('..', import.meta.url));
const reference = join(checkout, 'docs/reference');
const BASE = 'https://docs.seqera.io/nextflow';

const pages = (dir) =>
  readdirSync(join(reference, dir))
    .filter((file) => file.endsWith('.mdx'))
    .sort()
    .map((file) => [file.slice(0, -4), readFileSync(join(reference, dir, file), 'utf8')]);

const plain = (text) =>
  text
    .replace(/\[([^\]]+)\](?:\([^)]*\)|\[[^\]]*\])/g, '$1')
    .replace(/\*([^*`]+)\*/g, '$1')
    .trim();

/** The first sentence of the first paragraph in `body`, after notes, version badges and italic lines. */
function summary(body) {
  const lines = body.split('\n');
  let deprecated = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const block = line.match(/^:::|^```|^<(\w+)(?!.*\/>)/);
    if (block) {
      deprecated ||= block[1] === 'DeprecatedInVersion';
      const end = block[1] ? `</${block[1]}>` : block[0];
      if (!line.includes(end, 1)) while (++i < lines.length && !lines[i].trim().startsWith(end));
      continue;
    }
    if (!line || /^[<*#|]/.test(line)) continue;
    const paragraph = [];
    for (; i < lines.length && lines[i].trim() && !lines[i].startsWith('#'); i++) paragraph.push(lines[i].trim());
    const [first] = plain(paragraph.join(' ')).split(/(?<=[.!?])\s+(?=[A-Z])/);
    return deprecated ? `${first} Deprecated.` : first;
  }
}

const sentenceCase = (text) => text[0].toUpperCase() + text.slice(1);
// The reference describes functions in the imperative; the cards use the third person, as the operator cards do.
// Some pages already use it, and some descriptions start with another word, such as "When".
const thirdPerson = (text) =>
  text.replace(/^[A-Z][a-z]+\b/, (verb) => {
    if (/^(An?|If|The|When)$/.test(verb) || /[^s]s$/.test(verb)) return verb;
    if (/(s|sh|ch|x|z)$/.test(verb)) return `${verb}es`;
    return /[^aeiou]y$/.test(verb) ? `${verb.slice(0, -1)}ies` : `${verb}s`;
  });

/** Body of a page after its `# title`, without front matter. */
const body = (text) => text.split(/^# .*$/m)[1] ?? '';

function directives() {
  return Object.fromEntries(
    pages('process/directives').map(([slug, text]) => {
      const name = text.match(/^title: (\S+)$/m)[1];
      const description = summary(body(text)).replace(new RegExp(`^The \`${name}\` directive `), '');
      return [name, { href: `${BASE}/reference/process/directives/${slug}`, summary: sentenceCase(description) }];
    }),
  );
}

function scopes() {
  const all = pages('config')
    .filter(([slug]) => slug !== 'unscoped')
    .map(([slug, text]) => {
      const name = text.match(/^title: (\S+)$/m)[1];
      const description = summary(body(text)).replace(new RegExp(`^The \`${name}\` scope `), '');
      return [name, { href: `${BASE}/reference/config/${slug}`, summary: sentenceCase(description) }];
    });
  // No scope page, only a section of the configuration guide. The `process` settings are the process directives.
  all.push(
    [
      'process',
      {
        href: `${BASE}/config#process-configuration`,
        summary: 'Sets process directives separately from the pipeline code.',
      },
    ],
    ['params', { href: `${BASE}/config#parameters`, summary: 'Defines pipeline parameters.' }],
    [
      'profiles',
      {
        href: `${BASE}/config#config-profiles`,
        summary: 'Defines sets of settings that the `-profile` option selects at run time.',
      },
    ],
  );
  return Object.fromEntries(all.sort(([a], [b]) => a.localeCompare(b)));
}

// Docusaurus makes heading ids this way: `docker.enabled` becomes `dockerenabled`.
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

/** Each config setting by its full name, such as `docker.enabled`, with the unscoped ones, such as `workDir`. */
function settings() {
  const all = pages('config').flatMap(([page, text]) =>
    members(text, (name) => `${BASE}/reference/config/${page}#${slug(name)}`, { full: true })
      .filter(([name]) => !name.includes('<'))
      .map(([name, entry]) => [name, { href: entry.href, summary: entry.summary }]),
  );
  return Object.fromEntries(all.sort(([a], [b]) => a.localeCompare(b)));
}

const read = (path) => readFileSync(join(reference, path), 'utf8');

/**
 * The `#####` members in `text`: name, then href, signature, summary and the type it returns. Only the first
 * signature of an overloaded name is kept, and `returns` only if every overload returns the same type. With `full`,
 * the name is the whole heading, such as `docker.enabled`.
 */
function members(text, href, { prefix = '', full = false, verbs = false } = {}) {
  const found = new Map();
  for (const section of text.split(/^(?=#{1,5}\s)/m).filter((s) => /^#####\s+`[\w$]/.test(s))) {
    const [heading, ...rest] = section.split('\n');
    const signature = heading
      .replace(/^#####\s+`(.*)`.*$/, '$1')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')');
    const name = full ? signature : signature.match(/^[\w$]+/)[0];
    // Overloads can share one description, under the last heading.
    const description = summary(rest.join('\n'));
    const entry = {
      href: href(name),
      signature: `${prefix}${signature}`,
      summary: description && verbs && signature.includes('(') ? thirdPerson(description) : description,
      returns: returns(signature),
    };
    const first = found.get(name);
    if (!first) found.set(name, entry);
    else {
      first.summary ??= entry.summary;
      if (first.returns !== entry.returns) first.returns = undefined;
    }
  }
  return [...found].map(([name, { returns, summary, ...entry }]) => [
    name,
    { ...entry, ...(summary && { summary }), ...(returns && { returns }) },
  ]);
}

// The adapter follows these types through member calls; any other type ends the chain.
const TYPES = ['Bag', 'Duration', 'Iterable', 'List', 'Map', 'MemoryUnit', 'Path', 'Record', 'Set', 'String', 'Tuple'];
const KNOWN = new Set([...TYPES, 'Channel', 'VersionNumber']);

/** The type that a signature returns, without type arguments: `Path` for `file(…) -> Path | List<Path>`. */
function returns(signature) {
  const after = signature.includes('->')
    ? signature.slice(signature.lastIndexOf('->') + 2)
    : !signature.includes('(') && signature.includes(':')
      ? signature.slice(signature.indexOf(':') + 1)
      : '';
  const type = after.trim().match(/^[A-Z]\w*/)?.[0];
  return KNOWN.has(type) ? type : undefined;
}

/** The members of a standard library namespace. */
const namespace = (file, prefix = '') =>
  Object.fromEntries(
    members(read(`stdlib-namespaces/${file}.mdx`), () => `${BASE}/reference/stdlib-namespaces/${file}`, {
      prefix,
      verbs: true,
    }),
  );

/** The members of each type that has a page, without sub-types such as `Map.Entry`. */
function types() {
  const all = pages('stdlib-types').map(([page, text]) => {
    const name = text.match(/^title: (\w+)/m)[1];
    const own = body(text).split(/^## /m)[0];
    return [
      name,
      Object.fromEntries(
        members(own, () => `${BASE}/reference/stdlib-types/${page}`, { prefix: `${name}.`, verbs: true }),
      ),
    ];
  });
  return Object.fromEntries(all.filter(([name, map]) => TYPES.includes(name) && Object.keys(map).length > 0));
}

/** The `#####` members under each `## ` heading of a page, by heading. */
const parts = (text) =>
  Object.fromEntries(
    body(text)
      .split(/^## /m)
      .slice(1)
      .map((part) => [part.slice(0, part.indexOf('\n')).trim(), part]),
  );

/** Legacy qualifiers and the options for every output, which link to the section they are in. */
function qualifiers() {
  const page = `${BASE}/reference/process/inputs-outputs`;
  const { Inputs, Outputs, 'Generic options': options } = parts(read('process/inputs-outputs.mdx'));
  const map = (text, anchor) =>
    Object.fromEntries(
      members(text, () => `${page}#${anchor}`).map(([name, entry]) => [
        name,
        { ...entry, summary: thirdPerson(entry.summary) },
      ]),
    );
  return { inputs: map(Inputs, 'inputs'), outputs: map(Outputs, 'outputs'), options: map(options, 'generic-options') };
}

/** Stage directives and output functions of typed processes. */
function typedFunctions() {
  const page = `${BASE}/reference/process/inputs-outputs-typed`;
  const { 'Stage directives': stage, Outputs } = parts(read('process/inputs-outputs-typed.mdx'));
  return {
    stage: Object.fromEntries(members(stage, () => `${page}#stage-directives`)),
    outputs: Object.fromEntries(members(Outputs, () => `${page}#outputs`)),
  };
}

/** `task.attempt` and the other task properties, by the name after `task.`. */
const task = () =>
  Object.fromEntries(
    members(read('process/task-properties.mdx'), (name) => `${BASE}/reference/process/task-properties#${slug(name)}`, {
      full: true,
    }).map(([name, { signature, ...entry }]) => [name.slice('task.'.length), entry]),
  );

const flags = () =>
  Object.fromEntries(
    members(read('feature-flags.mdx'), (name) => `${BASE}/reference/feature-flags#${slug(name)}`, { full: true }).map(
      ([name, { signature, ...entry }]) => [name, entry],
    ),
  );

const sections = {
  input: { href: `${BASE}/reference/process/inputs-outputs#inputs`, summary: 'Declares the inputs of the process.' },
  output: { href: `${BASE}/reference/process/inputs-outputs#outputs`, summary: 'Declares the outputs of the process.' },
};

// The syntax reference and the guides have a section for each, but no first sentence that works on a card.
const SYNTAX = `${BASE}/reference/syntax`;
const keywords = {
  enum: { href: `${SYNTAX}#enum-type`, summary: 'Defines an enum type, a fixed list of names.' },
  include: {
    href: `${SYNTAX}#include`,
    summary: 'Includes processes, workflows, functions and types from another script.',
  },
  output: { href: `${SYNTAX}#output-block`, summary: 'Declares the workflow outputs and how to publish them.' },
  params: {
    href: `${SYNTAX}#params-block`,
    summary: 'Declares the pipeline parameters, each with a type and an optional default value.',
  },
  process: { href: `${SYNTAX}#process`, summary: 'Defines a process, which runs a task for each set of inputs.' },
  record: { href: `${SYNTAX}#record-type`, summary: 'Defines a record type, a set of fields with a name and a type.' },
  workflow: { href: `${SYNTAX}#workflow`, summary: 'Defines a named workflow, or the entry workflow of the script.' },
};

const PROCESS = `${BASE}/process`;
const TYPED = `${BASE}/process-typed`;
const labels = {
  process: {
    exec: { href: `${PROCESS}#native-execution`, summary: 'Runs Nextflow code for each task, without a job.' },
    script: { href: `${PROCESS}#script`, summary: 'Defines the script that each task runs.' },
    shell: {
      href: `${PROCESS}#shell`,
      summary: 'Defines the script that each task runs, with `!{…}` for Nextflow variables. Deprecated.',
    },
    stub: { href: `${PROCESS}#stub`, summary: 'Defines the script that each task runs with the `-stub` option.' },
    when: { href: `${PROCESS}#when`, summary: 'Defines a condition that each task must meet to run. Deprecated.' },
  },
  typed: {
    input: { href: `${TYPED}#inputs`, summary: 'Declares the inputs of the process, each with a name and a type.' },
    output: { href: `${TYPED}#outputs`, summary: 'Declares the outputs of the process.' },
    stage: { href: `${TYPED}#stage-directives`, summary: 'Stages inputs into the task directory.' },
    topic: { href: `${TYPED}#topics`, summary: 'Sends values to topic channels.' },
  },
  workflow: {
    emit: { href: `${BASE}/workflow#takes-and-emits`, summary: 'Declares the outputs of a named workflow.' },
    main: { href: `${SYNTAX}#workflow`, summary: 'Holds the statements of the workflow.' },
    onComplete: { href: `${SYNTAX}#workflow`, summary: 'Holds the statements that run when the workflow completes.' },
    onError: { href: `${SYNTAX}#workflow`, summary: 'Holds the statements that run when the workflow fails.' },
    publish: { href: `${SYNTAX}#workflow`, summary: 'Assigns channels to the workflow outputs.' },
    take: { href: `${BASE}/workflow#takes-and-emits`, summary: 'Declares the inputs of a named workflow.' },
  },
};

const data = {
  directives: directives(),
  scopes: scopes(),
  settings: settings(),
  sections,
  labels,
  keywords,
  qualifiers: qualifiers(),
  typedFunctions: typedFunctions(),
  task: task(),
  flags: flags(),
  globals: namespace('global'),
  namespaces: Object.fromEntries(['log', 'nextflow', 'workflow'].map((name) => [name, namespace(name, `${name}.`)])),
  types: types(),
};

const maps = (value) =>
  Object.values(value).every((entry) => typeof entry.href === 'string') ? [value] : Object.values(value).flatMap(maps);
const hrefs = new Set(maps(data).flatMap((map) => Object.values(map).map((entry) => entry.href)));
const urls = new Set([...hrefs].map((href) => href.split('#')[0]));
const html = new Map(
  await Promise.all(
    [...urls].map(async (url) => {
      const response = await fetch(url);
      return [url, response.ok ? await response.text() : `HTTP ${response.status}`];
    }),
  ),
);
const failures = [];
for (const href of hrefs) {
  const [url, anchor] = href.split('#');
  const page = html.get(url);
  if (page.startsWith('HTTP ')) failures.push(`${href}: ${page}`);
  else if (anchor && !new RegExp(`\\sid="?${anchor}["\\s>]`).test(page)) failures.push(`${href}: no such anchor`);
}
if (failures.length > 0) {
  console.error(`These links do not work on the live pages:\n${failures.join('\n')}`);
  process.exit(1);
}

const commit = execFileSync('git', ['-C', checkout, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
const checked = new Date().toISOString().slice(0, 10);
const out = join(root, 'packages/starlight-codeblocks/src/adapters/nextflow-reference-data.ts');
writeFileSync(
  out,
  `// Generated by scripts/nextflow-reference.mjs from nextflow-io/nextflow ${commit}. Do not edit.
// Links checked against the live pages on ${checked}.

export interface Entry {
  href: string;
  signature?: string;
  summary?: string;
  /** The type that a function returns, or the type of a property, if the adapter follows it. */
  returns?: string;
}

type Group = Record<string, Entry>;

export const directives: Group = ${JSON.stringify(data.directives)};

export const scopes: Group = ${JSON.stringify(data.scopes)};

/** Config settings by full name, such as \`docker.enabled\`, and the unscoped settings, such as \`workDir\`. */
export const settings: Group = ${JSON.stringify(data.settings)};

/** The \`input:\` and \`output:\` labels of a legacy process. */
export const sections: Group = ${JSON.stringify(data.sections)};

/** The other labels of a process, the labels of a typed process, and the labels of a workflow. */
export const labels: Record<'process' | 'typed' | 'workflow', Group> = ${JSON.stringify(data.labels)};

export const keywords: Group = ${JSON.stringify(data.keywords)};

/** Legacy input and output qualifiers, and the options of every output. */
export const qualifiers: Record<'inputs' | 'outputs' | 'options', Group> = ${JSON.stringify(data.qualifiers)};

/** Functions in the \`stage:\` section, and in the \`output:\` and \`topic:\` sections, of a typed process. */
export const typedFunctions: Record<'stage' | 'outputs', Group> = ${JSON.stringify(data.typedFunctions)};

/** Task properties by the name after \`task.\`. */
export const task: Group = ${JSON.stringify(data.task)};

export const flags: Group = ${JSON.stringify(data.flags)};

export const globals: Group = ${JSON.stringify(data.globals)};

export const namespaces: Record<string, Group> = ${JSON.stringify(data.namespaces)};

/** Members of each standard library type. \`List\`, \`Set\` and \`Bag\` also have the members of \`Iterable\`. */
export const types: Record<string, Group> = ${JSON.stringify(data.types)};
`,
);
execFileSync('pnpm', ['exec', 'biome', 'format', '--write', out], { cwd: root, stdio: 'inherit' });
console.log(`Wrote ${out}: ${hrefs.size} links checked.`);
