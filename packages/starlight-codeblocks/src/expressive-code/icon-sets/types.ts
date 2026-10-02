/** The file name rules of an icon set, with Iconify icon names. */
export interface IconSetRules {
  /** By lower-case file name, or by a path such as `.github/labeler.yml`. */
  fileNames: Record<string, string>;
  /** By lower-case extension with no leading dot, such as `ts` or `d.ts`. */
  fileExtensions: Record<string, string>;
  /** By VS Code language id. */
  languageIds: Record<string, string>;
  /** The icon of a file that no rule matches. */
  file: string;
  /** The variant of an icon for light themes. */
  light: Record<string, string>;
  /** Colours of the icons and their replacements in light themes. */
  palette?: Record<string, string>;
}
