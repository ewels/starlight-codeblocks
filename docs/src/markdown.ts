import { type CollectionEntry, getCollection } from 'astro:content';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  adapterOptions,
  attributes,
  commentSyntaxGroups,
  directives,
  type OptionEntry,
  options,
  pageOptions,
  styleGroups,
} from './components/reference.ts';
import { carouselGroups, sidebar, unlisted } from './sidebar.mjs';

export const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const siteUrl = new URL(`${base}/`, import.meta.env.SITE).href;

/** Absolute URL of a docs page, or of its Markdown version with `md`. */
export const pageUrl = (id: string, md = false) =>
  new URL(md ? `${id}.md` : id === 'index' ? '' : `${id}/`, siteUrl).href;

type Entry = CollectionEntry<'docs'>;

const docs = await getCollection('docs');
export const titles = new Map(docs.map((entry) => [entry.id, entry.data.title]));

/** Docs entries in sidebar order. */
export function entriesInOrder() {
  const entries = new Map(docs.map((entry) => [entry.id, entry]));
  const groups: { label: string; entries: Entry[] }[] = [];
  for (const group of sidebar) {
    const ids = group.items.map((item) => (typeof item === 'string' ? item : item.link.replace(/^\/$/, 'index')));
    groups.push({ label: group.label, entries: ids.map((id) => entries.get(id)).filter((e) => e !== undefined) });
    for (const id of ids) entries.delete(id);
  }
  for (const id of unlisted) entries.delete(id);
  if (entries.size > 0) throw new Error(`Pages missing from the sidebar: ${[...entries.keys()].join(', ')}`);
  return groups;
}

/** A fence long enough to hold `code`, which can contain fences of its own. */
function fenced(code: string, info: string) {
  const longest = Math.max(2, ...[...code.matchAll(/^\s*(`+)/gm)].map(([, ticks]) => ticks?.length ?? 0));
  const fence = '`'.repeat(longest + 1);
  return `${fence}${info}\n${code.replace(/\n$/, '')}\n${fence}`;
}

const absoluteLinks = (text: string) => text.replaceAll(`](${base}/`, `](${siteUrl}`);
const cell = (text: string) => text.replaceAll('|', '\\|').replaceAll('\n', ' ');
const descriptions = new Map(docs.map((entry) => [entry.id, entry.data.description ?? '']));
const featureLink = (page: string) => `[${titles.get(page) ?? page}](${pageUrl(page)})`;
const facts = (list: [string, string][]) => list.map(([term, value]) => `- ${term}: ${value}`).join('\n');
const code = (text: string) => `\`${text}\``;
const heading = (level: number, labels: string[]) => `${'#'.repeat(level)} ${labels.map(code).join(', ')}`;

function optionsMarkdown(entries: OptionEntry[], all: boolean) {
  return entries
    .map((option) =>
      [
        heading(all ? 2 : 3, [option.label]),
        option.description,
        facts([
          ['Type', option.type],
          ['Default', option.default],
          ...(all ? [['Feature', featureLink(option.page)] as [string, string]] : []),
        ]),
      ].join('\n\n'),
    )
    .join('\n\n');
}

const component: Record<string, (props: Record<string, string>, id: string) => string> = {
  Options: ({ adapter }, id) =>
    adapter
      ? optionsMarkdown(adapterOptions[adapter as keyof typeof adapterOptions], false)
      : id === 'reference/options'
        ? optionsMarkdown(options, true)
        : optionsMarkdown(pageOptions(id), false),
  Attributes: () =>
    attributes
      .map(({ syntax, description, page, example }) =>
        [
          heading(2, syntax),
          description,
          facts([['Feature', featureLink(page)]]),
          ...(example ? [fenced(example, 'md')] : []),
        ].join('\n\n'),
      )
      .join('\n\n'),
  Directives: () =>
    directives
      .map(({ label, placement, docs, example }) =>
        [
          heading(2, [label]),
          docs.description,
          facts([
            ['Placement', placement],
            ['Arguments', docs.args ?? 'None'],
            ['Feature', featureLink(docs.page)],
          ]),
          fenced(example, 'md'),
        ].join('\n\n'),
      )
      .join('\n\n'),
  StyleSettings: () =>
    styleGroups
      .map(({ name, defaults, page, settings = {} }) => {
        const value = (key: string, derived?: string) => {
          if (derived) return derived;
          const v = defaults[key];
          return Array.isArray(v) ? `${code(v[0])} dark, ${code(v[1])} light` : code(String(v));
        };
        const rows = Object.entries(settings).map(
          ([key, { description, derived }]) => `| ${code(key)} | ${cell(value(key, derived))} | ${cell(description)} |`,
        );
        return [
          heading(2, [name]),
          page ? `Settings of ${featureLink(page)}.` : 'Shared settings, which every feature uses.',
          ['| Setting | Default | Description |', '|---|---|---|', ...rows].join('\n'),
        ].join('\n\n');
      })
      .join('\n\n'),
  CommentSyntaxTable: () => {
    const rows = commentSyntaxGroups.map(
      ({ syntax, languages }) => `| ${cell(syntax.map(code).join(', '))} | ${languages.map(code).join(', ')} |`,
    );
    return ['| Comment syntax | Languages |', '|---|---|', ...rows].join('\n');
  },
};

/** The home page carousel as a list of the features in each sidebar group. */
function featureList() {
  return carouselGroups
    .map(({ label, ids }) =>
      [`### ${label}`, ids.map((id) => `- ${featureLink(id)}: ${descriptions.get(id)}`).join('\n')].join('\n\n'),
    )
    .join('\n\n');
}

const attrs = (text: string) =>
  Object.fromEntries([...text.matchAll(/(\w+)=(?:"([^"]*)"|\{(\w+)\})/g)].map(([, k, s, e]) => [k, s ?? e ?? '']));

/**
 * Turns the MDX source of a page into plain Markdown. `<Example>` becomes the Markdown source that
 * it shows, generated reference tables become Markdown, and imports and exports go.
 * Handles only the MDX that this site uses, and fails the build on anything else.
 */
export function pageMarkdown(entry: Entry) {
  const lines = (entry.body ?? '').split('\n');
  const out: string[] = [];
  const strings: Record<string, string> = {};
  const raw: Record<string, string> = {};
  let fence: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    if (fence) {
      out.push(line);
      if (line.trim().startsWith(fence) && line.trim().replace(/[`~]/g, '') === '') fence = undefined;
      continue;
    }
    const open = line.match(/^\s*(`{3,}|~{3,})/);
    if (open) {
      fence = open[1];
      out.push(line);
      continue;
    }
    const imp = line.match(/^import (\w+) from '([^']+)\?raw';$/);
    if (imp) {
      raw[imp[1] as string] = readFileSync(resolve(dirname(entry.filePath ?? ''), imp[2] as string), 'utf8');
      continue;
    }
    if (/^import .+ from '[^']+';$/.test(line)) continue;
    const exp = line.match(/^export const (\w+) = `$/);
    if (exp) {
      const body: string[] = [];
      while (lines[++i] !== '`;') {
        if (i >= lines.length) throw new Error(`Unclosed export in ${entry.id}`);
        body.push(lines[i] as string);
      }
      strings[exp[1] as string] = body.join('\n').replace(/\\([`$\\t])/g, (_, c: string) => (c === 't' ? '\t' : c));
      continue;
    }
    if (/^(import|export) /.test(line)) throw new Error(`No Markdown version of this line in ${entry.id}: ${line}`);
    const tag = line.match(/^(\s*)<(\/?)([A-Z]\w*)(.*?)(\/?)>$/);
    if (!tag) {
      if (line.trim() !== '' || out.at(-1)?.trim() !== '') out.push(absoluteLinks(line));
      continue;
    }
    const [, indent = '', closing, name = '', rest = '', selfClosing] = tag;
    const props = attrs(rest);
    if (closing || ['Tabs', 'Steps', 'Scrollycoding'].includes(name)) continue;
    if (name === 'Step') {
      out.push(absoluteLinks(line.replace(/<\/?Step[^>]*>/g, '').trim()), '');
      continue;
    }
    if (name === 'Example' || name === 'ThemeGallery') {
      const code = strings[props.code ?? ''];
      if (code === undefined) throw new Error(`<${name}> in ${entry.id} uses an unknown export`);
      out.push(fenced(code.trim(), 'md'));
      if (!selfClosing)
        while (lines[++i]?.trim() !== '</Example>') if (i >= lines.length) throw new Error('Unclosed <Example>');
    } else if (name === 'FeatureCarousel') {
      out.push(featureList());
      while (lines[++i]?.trim() !== '</FeatureCarousel>')
        if (i >= lines.length) throw new Error('Unclosed <FeatureCarousel>');
    } else if (name === 'Code') {
      out.push(fenced(raw[props.code ?? ''] ?? '', `${props.lang} title="${props.title}"`));
    } else if (name === 'TabItem') {
      out.push(`${indent}**${props.label}**`);
    } else if (name === 'Aside') {
      const type = props.type ?? 'note';
      out.push(`**${type[0]?.toUpperCase()}${type.slice(1)}:**`);
    } else if (component[name]) {
      out.push(absoluteLinks(component[name](props, entry.id)));
    } else {
      throw new Error(`No Markdown version of <${name}> in ${entry.id}`);
    }
  }

  const head = [`# ${entry.data.title}`];
  if (entry.data.description) head.push(`> ${entry.data.description}`);
  const tagline = entry.data.hero?.tagline;
  if (tagline)
    head.push(
      tagline
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/<\/?span[^>]*>/g, '')
        .replace(/<a href="([^"]+)">([^<]+)<\/a>/g, (_, href, text) => absoluteLinks(`[${text}](${href})`)),
    );
  return `${head.join('\n\n')}\n\n${out.join('\n').trim()}\n`;
}
