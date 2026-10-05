import { toHtml } from '@astrojs/starlight/expressive-code/hast';
import { bundledLanguagesInfo } from 'shiki/langs';
import {
  fileIconResolver,
  fileIconSets,
  iconSetScale,
} from '../../../packages/starlight-codeblocks/src/expressive-code/file-icons.ts';
import { definitions } from '../../../packages/starlight-codeblocks/src/expressive-code/file-icons-data.ts';

type Entry = [label: string, title: string, language: string];

/** Each row: what the icon is for, the title a code block would have, and its language. */
const top: Entry[] = [
  ['JavaScript', 'index.js', 'js'],
  ['TypeScript', 'index.ts', 'ts'],
  ['React', 'App.tsx', 'tsx'],
  ['Python', 'main.py', 'py'],
  ['Rust', 'main.rs', 'rust'],
  ['Go', 'main.go', 'go'],
  ['Java', 'Main.java', 'java'],
  ['Kotlin', 'Main.kt', 'kotlin'],
  ['C', 'main.c', 'c'],
  ['C++', 'main.cpp', 'cpp'],
  ['C#', 'Program.cs', 'csharp'],
  ['Ruby', 'app.rb', 'ruby'],
  ['PHP', 'index.php', 'php'],
  ['Swift', 'main.swift', 'swift'],
  ['Shell', 'install.sh', 'sh'],
  ['PowerShell', 'install.ps1', 'powershell'],
  ['HTML', 'index.html', 'html'],
  ['CSS', 'styles.css', 'css'],
  ['Sass', 'styles.scss', 'scss'],
  ['JSON', 'data.json', 'json'],
  ['YAML', 'config.yaml', 'yaml'],
  ['TOML', 'config.toml', 'toml'],
  ['Markdown', 'notes.md', 'md'],
  ['MDX', 'page.mdx', 'mdx'],
  ['Astro', 'Page.astro', 'astro'],
  ['Vue', 'App.vue', 'vue'],
  ['Svelte', 'App.svelte', 'svelte'],
  ['SQL', 'schema.sql', 'sql'],
  ['GraphQL', 'schema.graphql', 'graphql'],
  ['Lua', 'init.lua', 'lua'],
  ['package.json', 'package.json', 'json'],
  ['tsconfig.json', 'tsconfig.json', 'json'],
  ['Dockerfile', 'Dockerfile', 'docker'],
  ['README.md', 'README.md', 'md'],
  ['.gitignore', '.gitignore', 'txt'],
  ['GitHub workflow', '.github/workflows/ci.yml', 'yaml'],
];

const resolvers = await Promise.all(fileIconSets.map((set) => fileIconResolver({ set })));

const fallbacks = resolvers.map((icons) => icons.nameFor('', 'no-such-language'));

/** The icons of each entry in every set, as HTML, and the name of each icon. */
const rows = (entries: Entry[], { skipDefaults = false } = {}) =>
  entries
    .map(([label, title, language]) => ({
      label,
      title,
      language,
      names: resolvers.map((icons) => icons.nameFor(title, language)),
    }))
    .filter(({ names }) => !skipDefaults || names.some((name, i) => name !== fallbacks[i]))
    .map(({ label, title, names }) => ({
      label,
      title,
      icons: resolvers.map((icons, i) => {
        const set = fileIconSets[i] ?? 'seti';
        const scale = set === 'seti' ? 1 : iconSetScale[set];
        const name = names[i] || '';
        const svgs = icons.svgs(name);
        const html = svgs
          .map(({ svg, set: from }, variant) => {
            svg.properties = {
              ...svg.properties,
              class: 'set-icon',
              ...(from && { style: `--scale: ${scale}` }),
              ...(svgs.length > 1 && { dataVariant: variant === 0 ? 'dark' : 'light' }),
              ariaHidden: 'true',
            };
            return toHtml(svg);
          })
          .join('');
        return { name: name.replace(/^seti:/, ''), html };
      }),
    }));

const fileNames = [
  ...new Set([
    ...Object.keys(definitions.files),
    ...Object.keys(definitions.partials),
    '.editorconfig',
    '.env',
    '.gitignore',
    '.github/workflows/ci.yml',
    '.npmrc',
    '.prettierrc',
    'Cargo.toml',
    'docker-compose.yml',
    'Dockerfile',
    'Gemfile',
    'go.mod',
    'LICENSE',
    'Makefile',
    'package-lock.json',
    'package.json',
    'pyproject.toml',
    'requirements.txt',
    'tsconfig.json',
    'vite.config.ts',
  ]),
].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

/** The rows of each table: common files, every Shiki language, and file names with their own icons. */
export const iconSetTables = {
  top: rows(top),
  languages: rows(
    bundledLanguagesInfo
      .map(({ id, name }): Entry => [name, '', id])
      .sort(([a], [b]) => a.localeCompare(b, 'en', { sensitivity: 'base' })),
    { skipDefaults: true },
  ),
  files: rows(
    fileNames.map((name): Entry => [name, name, 'txt']),
    { skipDefaults: true },
  ),
};

export const iconSetNames = ['Seti', 'Material', 'vscode-icons', 'Catppuccin'];
