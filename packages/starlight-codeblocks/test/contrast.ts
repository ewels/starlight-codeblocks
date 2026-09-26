import { getColorContrast, onBackground } from '@expressive-code/core';
import { ExpressiveCode, type ExpressiveCodePlugin, type ExpressiveCodeTheme } from 'expressive-code';
import { pluginCodeblocks } from '../src/expressive-code/index.ts';

const starlight = new URL(
  '../node_modules/@astrojs/starlight/dist/integrations/expressive-code/theming.js',
  import.meta.url,
);

/** Starlight's default themes as a site gets them, then Expressive Code's own default themes. */
export async function themeSets(): Promise<(ExpressiveCodeTheme[] | undefined)[]> {
  const { preprocessThemes, applyStarlightUiThemeColors } = await import(starlight.href);
  return [preprocessThemes(undefined).map(applyStarlightUiThemeColors), undefined];
}

export interface Variant {
  type: 'dark' | 'light';
  name: string;
  get: (key: string) => string;
  /** The code foreground and every token colour of the theme that meets 4.5:1 on the code background. */
  text: string[];
}

export function toVariants(ec: ExpressiveCode): Variant[] {
  return ec.styleVariants.map((variant) => {
    const get = (key: string) => variant.resolvedStyleSettings.get(key as never) as string;
    const bg = get('codeBackground');
    const colours = variant.theme.settings.map((s) => s.settings.foreground).filter((c): c is string => !!c);
    const text = [...new Set([get('codeForeground'), ...colours])]
      .map((c) => onBackground(c, bg))
      .filter((c) => getColorContrast(c, bg) >= 4.5);
    return { type: variant.theme.type, name: variant.theme.name, get, text };
  });
}

export async function variants(plugins: ExpressiveCodePlugin[] = pluginCodeblocks()): Promise<Variant[]> {
  const out: Variant[] = [];
  for (const themes of await themeSets()) {
    const ec = new ExpressiveCode({ themes, plugins });
    await ec.getBaseStyles();
    out.push(...toVariants(ec));
  }
  return out;
}

/** Composes tint layers over the code background of the variant. */
export const tinted = (v: Variant, layers: string[]) =>
  layers.reduce((under, layer) => onBackground(layer, under), v.get('codeBackground'));

/** The lowest contrast of any text colour of the theme on the tint layers. */
export const minTextContrast = (v: Variant, layers: string[]) =>
  Math.min(...v.text.map((c) => getColorContrast(c, tinted(v, layers))));
