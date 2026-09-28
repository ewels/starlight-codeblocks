import { getCssVarName, type StyleSettingPath, type StyleVariant } from '@expressive-code/core';
import { apiCardStyles } from './expressive-code/api-links.ts';
import { floatLook, floatStyles, PREFIX } from './expressive-code/styles.ts';
import { styleVariants, themedCss } from './satteri/inline-code.ts';

export const CARD_CSS_ID = 'virtual:starlight-codeblocks/api-card.css';

/** The class of an API card outside code blocks. Its theme variables come from these page styles, not from a block. */
export const PAGE_CARD = `${PREFIX}-page`;

const SETTINGS: StyleSettingPath[] = [
  'codeblocks.popoverBackground',
  'codeblocks.popoverForeground',
  'codeblocks.popoverBorder',
  'codeblocks.popoverShadow',
  'codeblocks.popoverRadius',
  'codeblocks.popoverMaxWidth',
  'codeblocks.popoverFontSize',
  'codeblocks.mutedForeground',
  'uiFontFamily',
  'codeFontFamily',
];

const cssVar = (path: StyleSettingPath) => `var(${getCssVarName(path)})`;

/**
 * Styles for the API card of links outside code blocks, such as the signatures of starlight-pydocs.
 * `ec.<hash>.css` is only on pages with code blocks and scopes its rules to `.expressive-code`, so the
 * card gets the same rules here, and the theme variables that a block would give it.
 */
export function apiCardPageStyles(variants: StyleVariant[] = styleVariants()) {
  const card = `:where(.${PAGE_CARD}, .${PAGE_CARD} *)`;
  const look = `${floatStyles}\n${floatLook(cssVar)}\n${apiCardStyles(cssVar)}`.replace(/^\./gm, `${card}.`);
  const vars = (index: number) => {
    // The values that blocks declare, so that a card looks the same inside and outside them.
    const declared = variants[index]?.cssVarDeclarations;
    const declarations = SETTINGS.map((path) => getCssVarName(path)).map(
      (name) => `  ${name}: ${declared?.get(name)};`,
    );
    return `.${PAGE_CARD} {\n${declarations.join('\n')}\n}`;
  };
  return `${look}\n${themedCss(vars, variants)}`;
}
