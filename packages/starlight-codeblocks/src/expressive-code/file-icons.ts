import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PluginStyleSettings, type UnresolvedStyleValue } from '@expressive-code/core';
import { type Element, h, select } from '@expressive-code/core/hast';
import { fromHtml } from 'hast-util-from-html';
import { blockSetting, bundledLanguage, type CodeblocksPlugin, languageId, warn } from './core.ts';
import { icons as builtInIcons, definitions } from './file-icons-data.ts';
import type { IconSetRules } from './icon-sets/types.ts';
import { PREFIX } from './styles.ts';

export type FileIconStyle = 'plain' | 'tile';
export const fileIconSets = ['seti', 'material', 'vscode-icons', 'catppuccin'] as const;
export type FileIconSet = (typeof fileIconSets)[number];

export interface FileIconLanguage {
  icon?: string;
  colour?: string;
  style?: FileIconStyle;
}

export interface FileIconSettings {
  set: FileIconSet;
  style: FileIconStyle;
  languages: Record<string, FileIconLanguage>;
  files: Record<string, string>;
  icons: Record<string, string>;
}

export interface FileIconsStyleSettings {
  size: UnresolvedStyleValue;
  foreground: UnresolvedStyleValue;
  tileSize: UnresolvedStyleValue;
  tileRadius: UnresolvedStyleValue;
  tileBackground: UnresolvedStyleValue;
  tileForeground: UnresolvedStyleValue;
  darkVariantDisplay: UnresolvedStyleValue;
  lightVariantDisplay: UnresolvedStyleValue;
}

declare module '@expressive-code/core' {
  export interface StyleSettings {
    codeblocksFileIcons: FileIconsStyleSettings;
  }
}

const styleSettings = new PluginStyleSettings({
  defaultValues: {
    codeblocksFileIcons: {
      size: '0.85em',
      foreground: 'currentColor',
      tileSize: '1.1em',
      tileRadius: '22%',
      tileBackground: ({ resolveSetting }) => resolveSetting('codeblocks.accent'),
      tileForeground: ({ resolveSetting }) => resolveSetting('codeblocks.accentForeground'),
      darkVariantDisplay: ({ theme }) => (theme.type === 'dark' ? 'block' : 'none'),
      lightVariantDisplay: ({ theme }) => (theme.type === 'dark' ? 'none' : 'block'),
    },
  },
});

/** A CSS value that cannot break out of the `style` attribute. */
export const isCssColour = (value: string) => /^[\w\s#%().,/+-]+$/.test(value) && value.trim() !== '';

/** Rules on the path in the title, which come before the rules of the icon set. */
const pathRules: Record<string, string> = { '.github/**': 'github', '.gitattributes': 'github' };

// Shiki languages whose aliases name no file extension that Starlight knows.
const languageExtensions: Record<string, string> = {
  dotenv: '.env',
  htm: '.html',
  jsonc: '.json',
  jsonl: '.json',
  powershell: '.ps1',
  properties: '.properties',
  pycon: '.py',
  python: '.py',
  r: '.R',
  shellsession: '.sh',
};

/** How much larger each coloured set draws its icons, because they leave a margin inside their box. */
export const iconSetScale: Record<Exclude<FileIconSet, 'seti'>, number> = {
  material: 1.25,
  'vscode-icons': 1.2,
  catppuccin: 1.1,
};

/** VS Code language ids that differ from Shiki's, for the rules of the coloured sets. */
const vscodeLanguageIds: Record<string, string> = { jsx: 'javascriptreact', tsx: 'typescriptreact' };

interface IconSet {
  markup(name: string): string | undefined;
  forPath(path: string): string | undefined;
  forLanguage(names: string[]): string | undefined;
  fallback: string;
  /** The variant of an icon for light themes, if the set has one. */
  lightMarkup?(name: string): string | undefined;
}

/** Each suffix of a file name that starts at a dot: `x.test.ts` gives `.test.ts`, then `.ts`. */
const extensionsOf = (base: string) => {
  const out: string[] = [];
  for (let dot = base.indexOf('.'); dot !== -1; dot = base.indexOf('.', dot + 1)) out.push(base.slice(dot));
  return out;
};

const baseName = (path: string) => path.split('/').at(-1) ?? '';

/** The Seti icons and the file name rules of Starlight's `<FileTree>`. */
const seti: IconSet = {
  markup: (name) => builtInIcons[name] ?? builtInIcons[`seti:${name}`],
  forPath(path) {
    const base = baseName(path);
    return (
      definitions.files[base] ??
      extensionsOf(base)
        .map((extension) => definitions.extensions[extension])
        .find(Boolean) ??
      Object.entries(definitions.partials).find(([partial]) => base.includes(partial))?.[1]
    );
  },
  forLanguage(names) {
    for (const name of names) {
      const icon =
        definitions.extensions[languageExtensions[name] ?? `.${name}`] ?? (builtInIcons[`seti:${name}`] && name);
      if (icon) return icon;
    }
    return undefined;
  },
  fallback: 'seti:default',
};

interface IconifyIcon {
  body: string;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}

interface IconifyJson extends Omit<IconifyIcon, 'body'> {
  icons: Record<string, IconifyIcon>;
  aliases?: Record<string, { parent: string }>;
}

/** The `@iconify-json/*` package of each coloured set, which the site installs. */
const iconifyPackages: Record<Exclude<FileIconSet, 'seti'>, string> = {
  material: 'material-icon-theme',
  'vscode-icons': 'vscode-icons',
  catppuccin: 'catppuccin',
};

const ruleModules: Record<Exclude<FileIconSet, 'seti'>, () => Promise<{ rules: IconSetRules }>> = {
  material: () => import('./icon-sets/material.ts'),
  'vscode-icons': () => import('./icon-sets/vscode-icons.ts'),
  catppuccin: () => import('./icon-sets/catppuccin.ts'),
};

const loaded = new Map<FileIconSet, Promise<IconSet>>();

/** A coloured set: rules from the plugin, icons from the site's `@iconify-json/*` package. */
async function iconifySet(set: Exclude<FileIconSet, 'seti'>): Promise<IconSet> {
  const pkg = `@iconify-json/${iconifyPackages[set]}`;
  let path: string;
  try {
    path = createRequire(import.meta.url).resolve(`${pkg}/icons.json`);
  } catch {
    throw new Error(
      `starlight-codeblocks: \`fileIcons.set: '${set}'\` needs the \`${pkg}\` package. Add it to the site's dependencies.`,
    );
  }
  const data = JSON.parse(readFileSync(path, 'utf8')) as IconifyJson;
  const { rules } = await ruleModules[set]();
  const withPath = Object.entries(rules.fileNames).filter(([name]) => name.includes('/'));
  const cache = new Map<string, string | undefined>();
  const markup = (name: string) => {
    if (!cache.has(name)) {
      let target = name;
      for (let i = 0; data.aliases?.[target] && i < 8; i++) target = data.aliases[target]?.parent ?? target;
      const icon = data.icons[target];
      const box = (key: 'left' | 'top' | 'width' | 'height', fallback: number) => icon?.[key] ?? data[key] ?? fallback;
      cache.set(
        name,
        icon &&
          // Ids such as \`a\` repeat across icons, so two icons on a page would share a gradient.
          `<svg viewBox="${box('left', 0)} ${box('top', 0)} ${box('width', 16)} ${box('height', 16)}">${icon.body.replace(
            /(id="|url\(#|href="#)([\w-]+)/g,
            `$1${PREFIX}-${name}-$2`,
          )}</svg>`,
      );
    }
    return cache.get(name);
  };
  const { palette } = rules;
  return {
    markup,
    forPath(path) {
      const lowerPath = path.toLowerCase();
      const base = baseName(lowerPath);
      return (
        withPath.find(([name]) => lowerPath === name || lowerPath.endsWith(`/${name}`))?.[1] ??
        rules.fileNames[base] ??
        extensionsOf(base)
          .map((extension) => rules.fileExtensions[extension.slice(1)])
          .find(Boolean)
      );
    },
    forLanguage: (names) =>
      names.map((name) => rules.languageIds[vscodeLanguageIds[name] ?? name] ?? rules.languageIds[name]).find(Boolean),
    fallback: rules.file,
    lightMarkup(name) {
      const light = rules.light[name];
      if (light) return markup(light);
      const dark = palette && markup(name);
      return dark?.replace(/#[\da-f]{6}\b/gi, (hex) => palette?.[hex.toLowerCase()] ?? hex);
    },
  };
}

/** A matcher for a `files` key: a path pattern with `/` or `*`, an extension or name from a dot, or a file name. */
function fileRule(key: string): (path: string) => boolean {
  if (/[/*]/.test(key)) {
    const pattern = key
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '\0')
      .replace(/\*/g, '[^/]*')
      .replaceAll('\0', '.*');
    const regex = new RegExp(`(^|/)${pattern}$`);
    return (path) => regex.test(path);
  }
  if (key.startsWith('.')) return (path) => extensionsOf(baseName(path)).includes(key);
  return (path) => baseName(path) === key;
}

/** Whether an icon draws its own colours, so that the site colour and the tile colour do not apply. */
const isColoured = (markup: string) => /(fill|stop-color|stroke)="(#|rgb|hsl)/i.test(markup);

/** The `<svg>` of an icon: full SVG markup, inner SVG markup or a path in a 24 by 24 box. */
function svgElement(source: string): Element | undefined {
  const markup = source.trim();
  if (markup.startsWith('<svg')) {
    const svg = fromHtml(markup, { fragment: true, space: 'svg' }).children.find(
      (node): node is Element => node.type === 'element',
    );
    if (!svg) return undefined;
    svg.children = svg.children.filter((node) => node.type !== 'element' || node.tagName !== 'title');
    svg.properties.viewBox ??= '0 0 24 24';
    svg.properties.fill ??= 'currentColor';
    for (const key of ['width', 'height', 'class', 'className', 'style', 'xmlns', 'role']) delete svg.properties[key];
    return svg;
  }
  const children = markup.startsWith('<')
    ? (fromHtml(markup, { fragment: true, space: 'svg' }).children as Element[])
    : [h('path', { d: markup })];
  return h('svg', { viewBox: '0 0 24 24', fill: 'currentColor' }, children);
}

/**
 * Finds icons by name, title path and language. Rules from `files` come first, then the GitHub rules,
 * then the rules of the icon set. A name that the set does not have falls back to a Seti icon.
 */
export async function fileIconResolver({
  set = 'vscode-icons',
  languages = {},
  files = {},
  icons: siteIcons = {},
}: Partial<FileIconSettings> = {}) {
  let pending = loaded.get(set);
  if (!pending) {
    pending = set === 'seti' ? Promise.resolve(seti) : iconifySet(set);
    loaded.set(set, pending);
  }
  const iconSet = await pending;
  const rules = Object.entries({ ...pathRules, ...files })
    .reverse()
    .map(([key, icon]) => [fileRule(key), icon] as const);
  const icons = { ...siteIcons };
  // A language icon can be SVG markup, which then needs a name of its own.
  const byLanguage = new Map(
    Object.entries(languages).map(([lang, settings]) => {
      const id = languageId(lang);
      if (!settings.icon?.trim().startsWith('<')) return [id, settings];
      icons[`language:${id}`] = settings.icon;
      return [id, { ...settings, icon: `language:${id}` }];
    }),
  );

  const markup = (name: string) => icons[name] ?? iconSet.markup(name) ?? seti.markup(name);

  /** The icon name for the file path in a title, or `undefined`. */
  function forFileName(title: string) {
    const path = title.trim().replaceAll('\\', '/');
    if (!path) return undefined;
    return rules.find(([matches]) => matches(path))?.[1] ?? iconSet.forPath(path);
  }

  /** The icon name for a code block language, or `undefined`. */
  function forLanguage(lang: string) {
    const id = languageId(lang.toLowerCase());
    const own = byLanguage.get(id)?.icon;
    if (own) return own;
    return iconSet.forLanguage([...new Set([lang.toLowerCase(), id, ...(bundledLanguage(id)?.aliases ?? [])])]);
  }

  return {
    has: (name: string) => markup(name) !== undefined,
    /** The icon, and its variant for light themes when the set has one. */
    svgs(name: string) {
      const dark = markup(name);
      if (!dark) return [];
      const fromSet = set !== 'seti' && !icons[name] && iconSet.markup(name) !== undefined;
      const light = fromSet ? iconSet.lightMarkup?.(name) : undefined;
      return (light && light !== dark ? [dark, light] : [dark]).flatMap((source) => {
        const svg = svgElement(source);
        return svg ? [{ svg, coloured: isColoured(source), set: fromSet ? set : undefined }] : [];
      });
    },
    /** The icon name for a block, from its title, then its language, then the default of the set. */
    nameFor: (title: string, language: string) => forFileName(title) ?? forLanguage(language) ?? iconSet.fallback,
    svg: (name: string) => {
      const source = markup(name);
      return source === undefined ? undefined : svgElement(source);
    },
    forFileName,
    forLanguage,
    languageSettings: (lang: string) => byLanguage.get(languageId(lang.toLowerCase())),
  };
}

const ICON = `${PREFIX}-file-icon`;

/** Shows the icon of the file before the title of editor frames, from `icon`, the title, or the language. */
export function pluginFileIcons(settings: FileIconSettings): CodeblocksPlugin {
  const resolvers = new Map<FileIconSet, ReturnType<typeof fileIconResolver>>();
  const resolverFor = (set: FileIconSet) => {
    let resolver = resolvers.get(set);
    if (!resolver) {
      resolver = fileIconResolver({ ...settings, set }).then((icons) => {
        const named = [
          ...Object.values(settings.files),
          ...Object.keys(settings.languages).map((lang) => icons.languageSettings(lang)?.icon),
        ];
        const unknown = named.find((name) => name !== undefined && !icons.has(name));
        if (unknown) {
          throw new Error(
            `starlight-codeblocks: \`fileIcons\` names the icon "${unknown}", which is not in the \`${set}\` set or in \`fileIcons.icons\`.`,
          );
        }
        return icons;
      });
      resolvers.set(set, resolver);
    }
    return resolver;
  };
  return {
    name: 'starlight-codeblocks:file-icons',
    styleSettings,
    baseStyles: ({ cssVar }) => `
.frame.has-title:not(.is-terminal) .title:has(> .${ICON}) {
  display: inline-flex;
  align-items: center;
}
.${ICON} {
  flex-shrink: 0;
  width: ${cssVar('codeblocksFileIcons.size')};
  height: ${cssVar('codeblocksFileIcons.size')};
  margin-inline-end: 0.45em;
  /* Centred on the line box, an icon sits high next to lower-case text. */
  translate: 0 0.07em;
  color: var(--${ICON}-colour, ${cssVar('codeblocksFileIcons.foreground')});
  user-select: none;
}
${Object.entries(iconSetScale)
  .map(([set, scale]) => `.${ICON}[data-scb-file-icon-set='${set}'] { --${ICON}-scale: ${scale}; }`)
  .join('\n')}
/* The negative margin keeps the title bar height and the gap to the title. */
.${ICON}[data-scb-file-icon-set][data-scb-file-icon='plain'] {
  --${ICON}-grow: calc(${cssVar('codeblocksFileIcons.size')} * (var(--${ICON}-scale) - 1) / 2);
  width: calc(${cssVar('codeblocksFileIcons.size')} * var(--${ICON}-scale));
  height: calc(${cssVar('codeblocksFileIcons.size')} * var(--${ICON}-scale));
  margin-block: calc(-1 * var(--${ICON}-grow));
  margin-inline: calc(-1 * var(--${ICON}-grow)) calc(0.45em - var(--${ICON}-grow));
}
.${ICON}[data-scb-file-icon='tile'] {
  box-sizing: border-box;
  width: ${cssVar('codeblocksFileIcons.tileSize')};
  height: ${cssVar('codeblocksFileIcons.tileSize')};
  padding: calc(${cssVar('codeblocksFileIcons.tileSize')} * 0.17);
  border-radius: ${cssVar('codeblocksFileIcons.tileRadius')};
  background: ${cssVar('codeblocksFileIcons.tileBackground')};
  color: ${cssVar('codeblocksFileIcons.tileForeground')};
}
/* Black or white, whichever reads on a colour that the site or the block sets. */
.${ICON}[data-scb-file-icon='tile'][style] {
  background: var(--${ICON}-colour);
  color: oklch(from var(--${ICON}-colour) clamp(0, (0.65 - l) * 1000, 1) 0 0);
}
/* An icon with its own colours sits on a neutral tile, and a colour from the site or the block makes it one colour. */
.${ICON}[data-scb-file-icon='tile'][data-scb-file-icon-coloured]:not([style]) {
  background: color-mix(in srgb, ${cssVar('codeForeground')} 12%, transparent);
}
.${ICON}[data-scb-file-icon-coloured][style] *:not([fill='none']) { fill: currentColor; }
.${ICON}[data-scb-file-icon-coloured][style] [stroke]:not([stroke='none']) { stroke: currentColor; }
.${ICON}[data-scb-file-icon-variant='dark'] { display: ${cssVar('codeblocksFileIcons.darkVariantDisplay')}; }
.${ICON}[data-scb-file-icon-variant='light'] { display: ${cssVar('codeblocksFileIcons.lightVariantDisplay')}; }`,
    hooks: {
      async postprocessRenderedBlock(context) {
        const { codeBlock, renderData } = context;
        const figure = select('figure.frame.has-title', renderData.blockAst);
        const title =
          figure && !String(figure.properties.className).includes('is-terminal') && select('.title', figure);
        if (!title) return;
        const { metaOptions } = codeBlock;
        if (metaOptions.getBoolean('icon') === false || metaOptions.getBoolean('no-icon')) return;

        const icons = await resolverFor(
          blockSetting<FileIconSet>(
            context,
            'fileIcons.set',
            (raw) => fileIconSets.find((set) => set === raw),
            settings.set,
            fileIconSets.map((set) => `\`"${set}"\``).join(', '),
          ),
        );
        let name = metaOptions.getString('icon');
        if (name !== undefined && !icons.has(name)) {
          warn(context, `\`icon="${name}"\` is not a known icon. The block uses the icon of its title or language.`);
          name = undefined;
        }
        name ??= icons.nameFor(String(codeBlock.props.title ?? ''), codeBlock.language);
        const variants = icons.svgs(name);
        if (variants.length === 0) return;

        const language = icons.languageSettings(codeBlock.language);
        const style = blockSetting<FileIconStyle>(
          context,
          'fileIcons.style',
          (raw) => (raw === 'plain' || raw === 'tile' ? raw : undefined),
          language?.style ?? settings.style,
          '`"plain"` or `"tile"`',
        );
        const colour = blockSetting<string | undefined>(
          context,
          'fileIcons.colour',
          (raw) => (isCssColour(raw) ? raw : undefined),
          language?.colour,
          'a CSS colour',
        );
        const variantNames = variants.length > 1 ? ['dark', 'light'] : [undefined];
        for (const [i, { svg, coloured, set }] of variants.entries()) {
          svg.properties = {
            class: ICON,
            dataScbFileIcon: style,
            dataScbFileIconName: name.replace(/^seti:/, ''),
            ...(variantNames[i] && { dataScbFileIconVariant: variantNames[i] }),
            ...(coloured && { dataScbFileIconColoured: '' }),
            ...(set && { dataScbFileIconSet: set }),
            ...(colour && { style: `--${ICON}-colour: ${colour}` }),
            ariaHidden: 'true',
            focusable: 'false',
            ...svg.properties,
          };
        }
        title.children.unshift(...variants.map((variant) => variant.svg));
      },
    },
  };
}
