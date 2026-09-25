#!/usr/bin/env node
// Checks the rules in design/WRITING-STYLE.md, section 11.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

// "key" (as an adjective) and "essential" (as praise) are left out: a script cannot tell those uses
// from "the `focus` key" or a plain statement of need, so they stay a manual check.
const WORDS = `
simply, just, easy, easily, straightforward, obviously, of course, clearly, basically, actually,
really, very, quite, extremely, truly, genuinely, powerful, seamless, seamlessly, effortless,
effortlessly, robust, blazing, magic, magical, supercharge, unlock, unleash, elevate, empower,
delve, leverage, utilise, utilize, harness, landscape, ecosystem, tapestry, game-changer,
cutting-edge, best-in-class, next-level, world-class, crucial, crucially, vital, quietly, notably,
importantly, interestingly, arguably, fundamentally, various, numerous, a number of, a variety of,
etc., and more, and so on
`
  .trim()
  .split(/,\s*/);

const PHRASES = `
here's the thing, here's what, here's why, here's how, it turns out, the truth is, let me be clear,
let that sink in, make no mistake, this matters because, let's dive in, let's break this down,
let's explore, think of it as, imagine, it's worth noting, note that, at its core,
when it comes to, in order to, please, in this section, as we'll see, the rest of this page,
in conclusion, to sum up, in summary, serves as, stands as, acts as, this is important,
the benefits are significant, many users find
`
  .trim()
  .split(/,\s*/);

const MODALS = ['should', 'may', 'might', 'click', 'clicks', 'clicked', 'tap', 'taps', 'tapped'];

const AMERICAN = [
  /\bcolor(s|ed|ful|less)?\b/i,
  /\bbehavior(s|al)?\b/i,
  /\bcenter(s|ed)?\b/i,
  /\bcustomiz(e|es|ed|ation|ations)\b/i,
  /\borganiz(e|es|ed|ation|ations)\b/i,
  /\binitializ(e|es|ed|ation)\b/i,
  /\banalyz(e|es|ed|er|ers)\b/i,
  /\bfavorites?\b/i,
  /\bgray\b/i,
  /\blicenses?\b/i,
];

// Proper nouns and names that can keep their capitals in a heading.
const PROPER = [
  'Expressive Code',
  'Starlight',
  'Astro',
  'Markdown',
  'MDX',
  'VitePress',
  'Sätteri',
  'Shiki',
  'Nextflow',
  'Python',
  'Pyodide',
  'JavaScript',
  'TypeScript',
  'GitHub',
  'Pagefind',
  'Yarn',
  'API',
  'CSS',
  'HTML',
  'URL',
  'JSON',
  'WCAG',
  'I',
];

const CHARS = [
  [/[—–]/u, 'Use a full stop, comma, colon or brackets, not an em or en dash.'],
  [/[←-⇿]/u, 'Do not use arrow characters.'],
  [/[‘’“”]/u, 'Use straight quotes.'],
  [/\p{Extended_Pictographic}/u, 'Do not use emoji.'],
];

const apostrophe = (s) => s.replaceAll("'", "['’]");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const whole = (term) => new RegExp(`(?<![\\w-])${apostrophe(escapeRe(term))}(?![\\w-])`, 'i');
const TERMS = [
  ...WORDS.map((w) => [whole(w), 'banned-word', w]),
  ...PHRASES.map((p) => [whole(p), 'banned-phrase', p]),
  ...MODALS.map((m) => [whole(m), 'modal', m]),
  [/(^|[.!?]\s+)full stop\./i, 'banned-phrase', 'Full stop.'],
];

/** Replaces everything that is not prose with empty lines, so line numbers stay the same. */
function proseLines(text) {
  let fence = null;
  let frontMatter = text.startsWith('---\n');
  let comment = false;
  let tag = null;
  let literal = false;
  return text.split('\n').map((line, i) => {
    if (frontMatter) {
      if (i > 0 && line.trim() === '---') frontMatter = false;
      return '';
    }
    if (tag) {
      if (scanTag(line, tag)) tag = null;
      return '';
    }
    if (literal) {
      if (/^`;?\s*$/.test(line)) literal = false;
      return '';
    }
    if (fence) {
      if (line.trim().startsWith(fence) && line.trim().replace(/[`~]/g, '') === '') fence = null;
      return '';
    }
    if (comment) {
      if (line.includes('-->')) comment = false;
      return '';
    }
    const open = line.match(/^\s*(?:[-*+]\s+|\d+[.)]\s+)?(`{3,}|~{3,})/);
    if (open) {
      fence = open[1];
      return '';
    }
    if (/^\s*<!--/.test(line)) {
      comment = !line.includes('-->');
      return '';
    }
    if (/^(import|export)\s/.test(line)) {
      // An example in `export const x = \``: its escaped fences do not start a code block.
      literal = /=\s*`$/.test(line.trimEnd());
      return '';
    }
    if (/^\s*<\/?[A-Za-z]/.test(line)) {
      const state = { depth: 0, quote: null };
      if (!scanTag(line.slice(line.indexOf('<') + 1), state)) tag = state;
      const rest = tag ? '' : line.replace(/^\s*<[^>]*>/, '');
      return clean(rest);
    }
    return clean(line);
  });
}

/** Walks a JSX tag across lines, and returns true at the `>` that closes it. */
function scanTag(line, state) {
  for (const ch of line) {
    if (state.quote) {
      if (ch === state.quote) state.quote = null;
    } else if (ch === '`' || (state.depth === 0 && (ch === '"' || ch === "'"))) {
      state.quote = ch;
    } else if (ch === '{') state.depth++;
    else if (ch === '}') state.depth--;
    else if (ch === '>' && state.depth === 0) return true;
  }
  return false;
}

function clean(line) {
  return line
    .replace(/`+[^`]*`+/g, 'CODE')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/https?:\/\/\S+/g, 'URL');
}

const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
const sentences = (s) =>
  s
    .split(/(?<=[.!?])["')\]]*\s+/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Returns the problems in one Markdown or MDX document. */
export function lintText(text) {
  const problems = [];
  const report = (line, rule, message) => problems.push({ line: line + 1, rule, message });
  const lines = proseLines(text);

  lines.forEach((line, i) => {
    for (const [re, rule, term] of TERMS) if (re.test(line)) report(i, rule, `Do not use "${term}".`);
    for (const re of AMERICAN) {
      const m = line.match(re);
      if (m) report(i, 'spelling', `Use British spelling, not "${m[0]}".`);
    }
    for (const [re, message] of CHARS) if (re.test(line)) report(i, 'character', message);
    if (/^\s*(?:[-*+]|\d+[.)])\s+(\*\*|__)/.test(line))
      report(i, 'bold-list', 'Do not start a list item with bold text.');
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) checkHeading(heading[1], (message) => report(i, 'heading', message));
  });

  for (const block of blocks(lines)) {
    const found = sentences(block.text);
    const limit = block.numbered ? 20 : 25;
    for (const s of found) {
      const n = words(s).length;
      if (n > limit)
        report(block.line, 'sentence-length', `Sentence has ${n} words (limit ${limit}): "${s.slice(0, 60)}..."`);
    }
    if (block.kind === 'paragraph' && found.length > 6) {
      report(block.line, 'paragraph-length', `Paragraph has ${found.length} sentences (limit 6).`);
    }
  }
  return problems;
}

function checkHeading(text, report) {
  if (text.trim().endsWith('?')) report('Do not end a heading with a question mark.');
  let rest = text.replace(/^\d+(\.\d+)*\.?\s+/, '');
  for (const name of PROPER) rest = rest.replace(new RegExp(`(?<![\\w-])${escapeRe(name)}(?![\\w-])`, 'g'), 'PROPER');
  const [, ...tail] = words(rest);
  const bad = tail.filter((w) => w !== 'PROPER' && w !== 'CODE' && w !== 'URL' && /\p{Lu}/u.test(w));
  if (bad.length) report(`Use sentence case in headings: ${bad.join(', ')}.`);
}

/** Groups prose lines into paragraphs and list items. */
function* blocks(lines) {
  let current = null;
  const flush = function* () {
    if (current) yield current;
    current = null;
  };
  for (const [i, raw] of lines.entries()) {
    const line = raw.replace(/^\s*>\s?/, '');
    const item = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
    if (!line.trim() || /^#{1,6}\s/.test(line) || /^\s*\|/.test(line)) {
      yield* flush();
    } else if (item) {
      yield* flush();
      current = { kind: 'item', numbered: /\d/.test(item[1]), line: i, text: item[2] };
    } else if (current) {
      current.text += ` ${line.trim()}`;
    } else {
      current = { kind: 'paragraph', numbered: false, line: i, text: line.trim() };
    }
  }
  yield* flush();
}

function files() {
  const dir = join(root, 'docs/src/content/docs');
  const found = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.mdx?$/.test(e.name))
    .map((e) => join(e.parentPath, e.name));
  return [...found.sort(), join(root, 'README.md')];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const targets = process.argv.length > 2 ? process.argv.slice(2) : files();
  let count = 0;
  for (const file of targets) {
    for (const p of lintText(readFileSync(file, 'utf8'))) {
      count++;
      console.log(`${relative(root, file)}:${p.line}  ${p.rule}  ${p.message}`);
    }
  }
  if (count) {
    console.log(`\n${count} problem(s) in the docs.`);
    process.exit(1);
  }
}
