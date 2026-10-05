import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import { fileIconResolver } from '../src/expressive-code/file-icons.ts';
import { definitions, icons } from '../src/expressive-code/file-icons-data.ts';
import { type CodeblocksOptions, resolveOptions } from '../src/options.ts';
import { baseStyles, block, render as renderAny } from './render.ts';

const icon = (html: string) => html.match(/<svg class="scb-file-icon"[^>]*>/)?.[0];
const iconName = (html: string) => icon(html)?.match(/data-scb-file-icon-name="([^"]+)"/)?.[1];
// Most tests are about the rules of Starlight's <FileTree>, so they use the Seti set.
const render = (markdown: string, options: CodeblocksOptions = {}) =>
  renderAny(markdown, {
    ...options,
    fileIcons: options.fileIcons === false ? false : { set: 'seti', ...options.fileIcons },
  });
const pathD = (name: string) => icons[name]?.match(/d="([^"]+)"/)?.[1];

test('the vendored icons and rules match the installed Starlight', async () => {
  const dist = join(import.meta.dirname, '../node_modules/@astrojs/starlight/dist');
  const starlight = await import(pathToFileURL(join(dist, 'user-components/file-tree-icons.js')).href);
  const { Icons } = await import(pathToFileURL(join(dist, 'components-internals/Icons.js')).href);
  expect(definitions, 'run `node scripts/file-icons.mjs`').toEqual(starlight.definitions);
  for (const [name, svg] of Object.entries(icons)) expect(svg, name).toBe(Icons[name]);
});

test('finds the icon from the title as <FileTree> does, then from the language', async () => {
  const cases: [string, string][] = [
    ['js title="package.json"', 'json'],
    ['js title="astro.config.mjs"', 'astro'],
    ['ts title="src/utils/date.test.ts"', 'typescript'],
    ['txt title="Dockerfile.dev"', 'docker'],
    ['md title="README.md"', 'info'],
    ['py title="Example"', 'python'],
    ['console title="Not a terminal" frame="code"', 'shell'],
    ['txt title="notes"', 'default'],
  ];
  for (const [fence, name] of cases) expect(iconName((await render(block(fence, 'x'))).html), fence).toBe(name);
});

test('the icon goes first in the title, with the block unchanged otherwise', async () => {
  const { html, copyText, warnings } = await render(block('py title="app.py"', 'print(1)'));
  expect(html).toMatch(/<span class="title"><svg class="scb-file-icon"[^>]*aria-hidden="true"[^>]*><path d="/);
  expect(html).toContain(`d="${pathD('seti:python')}"`);
  expect(copyText).toBe('print(1)');
  expect(warnings).toEqual([]);
  const off = await render(block('py title="app.py"', 'print(1)'), { fileIcons: false });
  expect(icon(off.html)).toBeUndefined();
  expect(html.replace(/<svg class="scb-file-icon".*?<\/svg>/, '')).toBe(off.html);
});

test('vscode-icons is the default set', async () => {
  const { html } = await renderAny(block('json title="package.json"', 'x'));
  expect(iconName(html)).toBe('file-type-npm');
  expect(icon(html)).toContain('data-scb-file-icon-coloured');
});

test('no icon without a title, in terminal frames, or with icon=false', async () => {
  for (const fence of ['js', 'sh title="Install"', 'js title="a.js" icon=false', 'js title="a.js" no-icon']) {
    expect(icon((await render(block(fence, 'x'))).html), fence).toBeUndefined();
  }
});

test('`icon` picks an icon by name, with or without `seti:`, and warns for an unknown one', async () => {
  expect(iconName((await render(block('js title="a.js" icon="react"', 'x'))).html)).toBe('react');
  expect(iconName((await render(block('js title="a.js" icon="seti:vue"', 'x'))).html)).toBe('vue');
  const unknown = await render(block('js title="a.js" icon="nope"', 'x'));
  expect(iconName(unknown.html)).toBe('javascript');
  expect(unknown.warnings).toEqual([expect.stringContaining('`icon="nope"` is not a known icon')]);
});

test('style and colour come from the block, then the language, then the site', async () => {
  const site = {
    fileIcons: { style: 'tile' as const, languages: { py: { colour: '#3776ab', style: 'plain' as const } } },
  };
  expect(icon((await render(block('js title="a.js"', 'x'), site)).html)).toContain('data-scb-file-icon="tile"');
  const py = icon((await render(block('python title="a.py"', 'x'), site)).html);
  expect(py).toContain('data-scb-file-icon="plain"');
  expect(py).toContain('style="--scb-file-icon-colour: #3776ab"');
  const own = icon(
    (await render(block('py title="a.py" fileIcons.style="tile" fileIcons.colour="rebeccapurple"', 'x'), site)).html,
  );
  expect(own).toContain('data-scb-file-icon="tile"');
  expect(own).toContain('--scb-file-icon-colour: rebeccapurple');
  const bad = await render(block('js title="a.js" fileIcons.style="big" fileIcons.colour="red;x:y"', 'x'));
  expect(icon(bad.html)).toContain('data-scb-file-icon="plain"');
  expect(icon(bad.html)).not.toContain('style=');
  expect(bad.warnings).toHaveLength(2);
});

test('custom icons, file names and languages', async () => {
  const fileIcons = {
    icons: {
      nextflow: 'M2 2h20v20H2z',
      brand: '<svg viewBox="0 0 16 16"><title>Brand</title><circle cx="8" cy="8" r="8" fill="#f00"/></svg>',
      // A custom name replaces a built-in icon.
      'seti:json': '<path d="M1 1h2v2H1z"/>',
    },
    files: { 'nextflow.config': 'nextflow', '.cfg': 'brand' },
    languages: { nextflow: { icon: 'nextflow' } },
  };
  const nf = await render(block('nextflow title="main.nf"', 'x'), { fileIcons });
  expect(icon(nf.html)).toContain('viewBox="0 0 24 24"');
  expect(nf.html).toContain('<path d="M2 2h20v20H2z">');
  expect(iconName((await render(block('groovy title="nextflow.config"', 'x'), { fileIcons })).html)).toBe('nextflow');
  const brand = (await render(block('ini title="app.cfg"', 'x'), { fileIcons })).html;
  expect(icon(brand)).toContain('viewBox="0 0 16 16"');
  expect(brand).toContain('fill="#f00"');
  expect(brand).not.toContain('<title>');
  expect((await render(block('json title="a.json"', 'x'), { fileIcons })).html).toContain('<path d="M1 1h2v2H1z">');
  await expect(() =>
    render(block('js title="a.js"', 'x'), { fileIcons: { files: { '.x': 'missing' } } }),
  ).rejects.toThrow('"missing"');
});

test('`false` in `files` or `languages` gives no icon, and `icon="<name>"` still sets one', async () => {
  const fileIcons = {
    files: { '.mmd': false as const, 'special.mmd': 'markdown' },
    languages: { metro: { icon: false as const, colour: '#f00' } },
  };
  const iconOf = async (meta: string) => icon((await render(block(meta, 'x'), { fileIcons })).html);
  expect(await iconOf('txt title="flow.mmd"')).toBeUndefined();
  // A `false` rule stops the search, so the language gives no icon either.
  expect(await iconOf('js title="flow.mmd"')).toBeUndefined();
  expect(iconName((await render(block('txt title="special.mmd"', 'x'), { fileIcons })).html)).toBe('markdown');
  expect(await iconOf('metro title="Example"')).toBeUndefined();
  expect(iconName((await render(block('metro title="flow.js"', 'x'), { fileIcons })).html)).toBe('javascript');
  for (const meta of ['txt title="flow.mmd" icon="react"', 'metro title="Example" icon="react"']) {
    expect(iconName((await render(block(meta, 'x'), { fileIcons })).html), meta).toBe('react');
  }
  expect(await iconOf('js title="a.js" icon=false')).toBeUndefined();
  expect(iconName((await render(block('js title="a.js"', 'x'), { fileIcons })).html)).toBe('javascript');
  expect(iconName((await render(block('txt title="flow.mmd"', 'x'))).html)).toBe('default');
});

test('options are validated', () => {
  expect(
    resolveOptions({ fileIcons: { files: { '.mmd': false }, languages: { metro: { icon: false } } } }).fileIcons,
  ).toMatchObject({ files: { '.mmd': false }, languages: { metro: { icon: false } } });
  expect(() => resolveOptions({ fileIcons: { files: { '.mmd': true as never } } })).toThrow('fileIcons.files');
  expect(() => resolveOptions({ fileIcons: { languages: { metro: { icon: true as never } } } })).toThrow(
    'fileIcons.languages',
  );
  expect(resolveOptions().fileIcons).toEqual({
    set: 'vscode-icons',
    style: 'plain',
    languages: {},
    files: {},
    icons: {},
  });
  expect(() => resolveOptions({ fileIcons: { set: 'vscode' as never } })).toThrow('fileIcons.set');
  expect(() => resolveOptions({ fileIcons: { style: 'round' as never } })).toThrow('fileIcons.style');
  expect(() => resolveOptions({ fileIcons: { languages: { py: { colour: 'red; x: y' } } } })).toThrow(
    'fileIcons.languages',
  );
  expect(() => resolveOptions({ fileIcons: { languages: { py: { size: 1 } as never } } })).toThrow();
});

test('the code tabs menu uses the same language icons, custom ones included', async () => {
  const icons = await fileIconResolver({
    set: 'seti',
    icons: { nextflow: 'M0 0h1v1H0z' },
    languages: { nextflow: { icon: 'nextflow' } },
  });
  expect(icons.forLanguage('nextflow')).toBe('nextflow');
  expect(icons.forLanguage('bash')).toBe('seti:shell');
  expect(icons.forLanguage('unknown-language')).toBeUndefined();
});

test('tile colours come from the theme accent, with black or white on a custom colour', async () => {
  const css = await baseStyles();
  expect(css).toContain("[data-scb-file-icon='tile'][style]");
  expect(css).toMatch(/oklch\(from var\(--scb-file-icon-colour\)/);
});

test('GitHub files get the GitHub icon, from the path in the title', async () => {
  for (const title of [
    '.github/workflows/test.yml',
    'repo/.github/dependabot.yml',
    '.github/CODEOWNERS',
    '.gitattributes',
  ]) {
    expect(iconName((await render(block(`yaml title="${title}"`, 'x'))).html), title).toBe('github');
  }
  expect(iconName((await render(block('yaml title="workflows/test.yml"', 'x'))).html)).toBe('yml');
});

test('`files` takes path patterns, with `*` inside one folder and `**` across folders', async () => {
  const icons = await fileIconResolver({
    set: 'seti',
    files: { 'docs/*.md': 'book', 'config/**': 'config', '.github/**': 'git' },
  });
  expect(icons.forFileName('docs/intro.md')).toBe('book');
  expect(icons.forFileName('docs/guides/intro.md')).toBe('seti:markdown');
  expect(icons.forFileName('src/config/a/b.json')).toBe('config');
  // A site rule replaces a built-in one.
  expect(icons.forFileName('.github/workflows/ci.yml')).toBe('git');
});

test('the material set gives coloured icons, with its own rules, light variants and unique ids', async () => {
  const fileIcons = { set: 'material' as const };
  const json = await render(block('json title="package.json"', 'x'), { fileIcons });
  expect(iconName(json.html)).toBe('nodejs');
  expect(icon(json.html)).toContain('data-scb-file-icon-coloured');
  expect(iconName((await render(block('py title="Example"', 'x'), { fileIcons })).html)).toBe('python');
  expect(iconName((await render(block('txt title="notes"', 'x'), { fileIcons })).html)).toBe('document');
  // A name that the set does not have comes from Seti.
  expect(iconName((await render(block('yaml title=".github/workflows/ci.yml"', 'x'), { fileIcons })).html)).toBe(
    'github',
  );
  const toml = (await render(block('toml title="Cargo.toml"', 'x'), { fileIcons })).html;
  expect(toml).toContain('data-scb-file-icon-name="toml" data-scb-file-icon-variant="dark"');
  expect(toml).toContain('data-scb-file-icon-name="toml" data-scb-file-icon-variant="light"');
  const resolver = await fileIconResolver(fileIcons);
  const withIds = ['aurelia'].map((name) => resolver.svgs(name)[0]);
  expect(JSON.stringify(withIds)).toContain('scb-aurelia-');
  expect(JSON.stringify(withIds)).not.toMatch(/"id":"[a-z]"/);
});

test('vscode-icons and Catppuccin give their own icons, and Catppuccin uses Latte colours in light themes', async () => {
  const vscode = { set: 'vscode-icons' as const };
  expect(iconName((await render(block('json title="package.json"', 'x'), { fileIcons: vscode })).html)).toBe(
    'file-type-npm',
  );
  expect(iconName((await render(block('py title="Example"', 'x'), { fileIcons: vscode })).html)).toBe(
    'file-type-python',
  );
  const catppuccin = { set: 'catppuccin' as const };
  const py = (await render(block('py title="app.py"', 'x'), { fileIcons: catppuccin })).html;
  expect(iconName(py)).toBe('python');
  // Macchiato blue in dark themes, Latte blue in light themes.
  expect(py).toMatch(/data-scb-file-icon-variant="dark"[^>]*>.*#8aadf4/);
  expect(py).toMatch(/data-scb-file-icon-variant="light"[^>]*>.*#1e66f5/);
});

test('the generated rules name only icons that the installed Iconify packages have', async () => {
  for (const set of ['material', 'vscode-icons', 'catppuccin'] as const) {
    const { rules } = await import(`../src/expressive-code/icon-sets/${set}.ts`);
    const resolver = await fileIconResolver({ set });
    const names = new Set<string>([
      rules.file,
      ...Object.values<string>(rules.fileNames),
      ...Object.values<string>(rules.fileExtensions),
      ...Object.values<string>(rules.languageIds),
      ...Object.values<string>(rules.light),
    ]);
    const missing = [...names].filter((name) => resolver.svgs(name).length === 0);
    expect(missing, `${set}: run \`node scripts/icon-sets.mjs\``).toEqual([]);
  }
});

test('a language icon can be SVG markup', async () => {
  const fileIcons = {
    languages: { nextflow: { icon: '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>' } },
  };
  const { html, warnings } = await render(block('nextflow title="main.nf"', 'x'), { fileIcons });
  expect(iconName(html)).toBe('language:nextflow');
  expect(icon(html)).toContain('viewBox="0 0 10 10"');
  expect(warnings).toEqual([]);
});
