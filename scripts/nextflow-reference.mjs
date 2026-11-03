#!/usr/bin/env node
// Rebuilds the Nextflow adapter's directives, config scopes and standard library from a nextflow-io/nextflow
// checkout, and checks every link against the live pages: `node scripts/nextflow-reference.mjs <checkout>`.
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
const thirdPerson = (text) => text.replace(/^\w+/, (verb) => (/(s|sh|ch|x|z)$/.test(verb) ? `${verb}es` : `${verb}s`));

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
      const settings = [...text.matchAll(new RegExp(`^#####\\s+\`${name}\\.([\\w$]+)`, 'gm'))].map((m) => m[1]);
      return [
        name,
        {
          href: `${BASE}/reference/config/${slug}`,
          summary: sentenceCase(description),
          settings: [...new Set(settings)],
        },
      ];
    });
  // No scope page, only a section of the configuration guide. The `process` settings are the process directives.
  all.push(
    [
      'process',
      {
        href: `${BASE}/config#process-configuration`,
        summary: 'Sets process directives separately from the pipeline code.',
        settings: [],
      },
    ],
    ['params', { href: `${BASE}/config#parameters`, summary: 'Defines pipeline parameters.', settings: [] }],
    [
      'profiles',
      {
        href: `${BASE}/config#config-profiles`,
        summary: 'Defines sets of settings that the `-profile` option selects at run time.',
        settings: [],
      },
    ],
  );
  return Object.fromEntries(all.sort(([a], [b]) => a.localeCompare(b)));
}

/** The members of a standard library namespace, from its `#####` headings. */
function namespace(file, prefix = '') {
  const text = readFileSync(join(reference, 'stdlib-namespaces', `${file}.mdx`), 'utf8');
  const members = text.split(/^(?=#{1,5}\s)/m).filter((section) => /^#####\s/.test(section));
  return Object.fromEntries(
    members.map((section) => {
      const [heading, ...rest] = section.split('\n');
      const signature = heading
        .replace(/^#####\s+`(.*)`.*$/, '$1')
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')');
      const name = signature.match(/^[\w$]+/)[0];
      const description = summary(rest.join('\n'));
      return [
        name,
        {
          href: `${BASE}/reference/stdlib-namespaces/${file}`,
          signature: `${prefix}${signature}`,
          summary: signature.includes('(') ? thirdPerson(description) : description,
        },
      ];
    }),
  );
}

const sections = {
  input: { href: `${BASE}/reference/process/inputs-outputs#inputs`, summary: 'Declares the inputs of the process.' },
  output: { href: `${BASE}/reference/process/inputs-outputs#outputs`, summary: 'Declares the outputs of the process.' },
};

const data = {
  directives: directives(),
  scopes: scopes(),
  sections,
  globals: namespace('global'),
  namespaces: Object.fromEntries(['log', 'nextflow', 'workflow'].map((name) => [name, namespace(name, `${name}.`)])),
};

const hrefs = new Set(
  [data.directives, data.scopes, data.sections, data.globals, ...Object.values(data.namespaces)].flatMap((map) =>
    Object.values(map).map((entry) => entry.href),
  ),
);
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
  /** The first part of each setting name that the scope page lists, or none for a scope that takes any name. */
  settings?: string[];
}

export const directives: Record<string, Entry> = ${JSON.stringify(data.directives)};

export const scopes: Record<string, Entry> = ${JSON.stringify(data.scopes)};

/** Process sections that the inputs and outputs page has an anchor for. */
export const sections: Record<string, Entry> = ${JSON.stringify(data.sections)};

export const globals: Record<string, Entry> = ${JSON.stringify(data.globals)};

export const namespaces: Record<string, Record<string, Entry>> = ${JSON.stringify(data.namespaces)};
`,
);
execFileSync('pnpm', ['exec', 'biome', 'format', '--write', out], { cwd: root, stdio: 'inherit' });
console.log(`Wrote ${out}: ${hrefs.size} links checked.`);
