/** Docs for the attributes and style settings reference pages. `test/reference.test.ts` keeps them complete. */

export interface AttributeDoc {
  /** The attribute key, or `<state>` for custom line states. */
  name: string;
  /** Each form of the attribute, as an author writes it. */
  syntax: string[];
  description: string;
  page: string;
  /** A small code block that shows only this attribute. Left out when it needs a directive or a component around it. */
  example?: { lang: string; meta: string; code: string };
}

/** The fence line attribute `<feature>.style` of annotations and footnotes. */
const noteStyleAttribute = (
  feature: string,
  marks: string,
  lang: string,
  code: string,
  shown: string,
): AttributeDoc => ({
  name: `${feature}.style`,
  syntax: [`${feature}.style="filled"`, `${feature}.style="outline"`],
  description: `Draws the ${marks} filled in the accent colour, or outlined in the magenta of the theme. It overrides the \`${feature}.style\` option for the block.`,
  page: `features/${feature}`,
  example: { lang, meta: `${feature}.style="${shown}"`, code },
});

export const attributesReference: AttributeDoc[] = [
  {
    name: 'focus',
    syntax: ['focus={range}'],
    description: 'Focuses the lines in the range. The other lines are blurred.',
    page: 'features/focus',
    example: {
      lang: 'js',
      meta: 'focus={2}',
      code: "const host = 'localhost'\nconst port = 8080\nconst debug = false",
    },
  },
  {
    name: 'error',
    syntax: ['error={range}', 'warning={range}', 'info={range}', 'success={range}', 'note={range}', 'warn={range}'],
    description:
      'Marks the lines in the range with a line state. `note` is the same as `info`, and `warn` the same as `warning`. The attribute gives no message. Use a directive for a message.',
    page: 'features/line-states',
    example: { lang: 'js', meta: 'error={2}', code: 'const retries = 3\nconst delay = -1\nconst timeout = 5000' },
  },
  {
    name: '<state>',
    syntax: ['<state>={range}'],
    description:
      'Marks the lines in the range with a custom line state from the `lineStates.states` option. This site defines `todo`.',
    page: 'features/line-states',
    example: { lang: 'js', meta: 'todo={2}', code: "const host = 'localhost'\nconst port = 8080\nconst debug = false" },
  },
  {
    name: 'hidden',
    syntax: ['hidden={range}'],
    description: 'Hides the lines in the range behind a marker. The copy button still copies them.',
    page: 'features/hidden-lines',
    example: {
      lang: 'js',
      meta: 'hidden={1-2}',
      code: "import { readFile } from 'node:fs/promises';\n\nconst text = await readFile('config.json', 'utf8');",
    },
  },
  {
    name: 'whitespace',
    syntax: ['whitespace', 'whitespace="all"'],
    description:
      'Shows spaces and tabs as faint glyphs. The flag shows leading whitespace only. `"all"` shows every space and tab.',
    page: 'features/visible-whitespace',
    example: { lang: 'yaml', meta: 'whitespace', code: 'server:\n  port: 8080\n  hosts:\n    - example.com' },
  },
  {
    name: 'brackets',
    syntax: ['brackets', 'brackets=false'],
    description:
      'Colours matching brackets by nesting depth. The `brackets.languages` option turns it on for whole languages, and `brackets=false` turns it off for one block.',
    page: 'features/colourised-brackets',
    example: { lang: 'js', meta: 'brackets', code: 'const total = items.map((item) => item.price * (1 + tax));' },
  },
  {
    name: 'swatches',
    syntax: ['swatches', 'swatches=false'],
    description:
      'Shows a swatch before each CSS colour. Swatches are on for every block by default, and `swatches=false` turns them off for one block. With `swatches.languages` set, `swatches` turns them on for a block of another language.',
    page: 'features/colour-swatches',
    example: {
      lang: 'css',
      meta: 'swatches=false',
      code: '.button {\n  color: #ffffff;\n  background: rebeccapurple;\n}',
    },
  },
  {
    name: 'swatches.shape',
    syntax: ['swatches.shape="square"', 'swatches.shape="rounded"', 'swatches.shape="circle"'],
    description: 'Sets the shape of the swatches in the block. It overrides the `swatches.shape` option for the block.',
    page: 'features/colour-swatches',
    example: { lang: 'css', meta: 'swatches.shape="circle"', code: '.badge {\n  background: #2563eb;\n}' },
  },
  {
    name: 'wordDiff',
    syntax: ['wordDiff=false'],
    description: 'Turns off word-level diff for the block. Changed lines keep their whole-line tints.',
    page: 'features/word-level-diff',
    example: { lang: 'diff', meta: 'wordDiff=false', code: '-const port = 3000\n+const port = 8080' },
  },
  {
    name: 'apiLinks',
    syntax: ['apiLinks=false'],
    description: 'Turns off API auto-linking for the block. Names stay plain text.',
    page: 'features/api-auto-linking',
    example: { lang: 'py', meta: 'apiLinks=false', code: 'import json\n\nconfig = json.loads(\'{"port": 8080}\')' },
  },
  {
    name: 'pydocsBase',
    syntax: ['pydocsBase="<base>"'],
    description:
      'Makes the Python adapter link names to the starlight-pydocs package at this base first, such as `1x/api/myproject` for an older version. Names that this package does not have link as usual.',
    page: 'features/api-auto-linking',
  },
  {
    name: 'expandable',
    syntax: ['expandable', 'expandable={N}', 'expandable=false'],
    description:
      'Shows the first lines of the block, with a button to show the rest. The flag shows the number of lines in the `expandable.lines` option. `{N}` shows `N` lines. `false` turns off the `expandable.auto` option for the block.',
    page: 'features/expandable-blocks',
    example: {
      lang: 'yaml',
      meta: 'expandable={3}',
      code: 'name: Build\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v5',
    },
  },
  {
    name: 'playground',
    syntax: ['playground="<name>"'],
    description:
      'Adds a button to the title bar that opens the code in a playground. The built-in names are `typescript` and `rust`.',
    page: 'features/open-in-playground',
    example: { lang: 'ts', meta: 'playground="typescript"', code: "const greet = (name: string) => 'Hello, ' + name;" },
  },
  {
    name: 'id',
    syntax: ['id="<id>"'],
    description: 'Turns on line numbers, and makes each number a link to its line, as `#<id>-L<n>`.',
    page: 'features/line-permalinks',
    example: { lang: 'js', meta: 'id="server"', code: "const host = 'localhost'\nconst port = 8080" },
  },
  {
    name: 'placeholder',
    syntax: ['placeholder="<A>,<B>"'],
    description:
      'Turns each listed text in the block into an input field. The value that a reader types fills every block on the site.',
    page: 'features/fill-in-placeholders',
    example: { lang: 'sh', meta: 'placeholder="YOUR_TOKEN"', code: 'export API_TOKEN=YOUR_TOKEN' },
  },
  {
    name: 'annotations',
    syntax: ['annotations="side"'],
    description: 'Shows the `[!annotate]` notes of the block in a column beside the code, on wide screens.',
    page: 'features/side-annotations',
    example: {
      lang: 'js',
      meta: 'annotations="side"',
      code: "const port = 8080 // [!annotate] The port that the server listens on.\nconst host = 'localhost'",
    },
  },
  {
    name: 'codeSide',
    syntax: ['codeSide="right"'],
    description:
      'With `annotations="side"`, puts the code in the right column and the notes in the left column. The default is `left`.',
    page: 'features/side-annotations',
  },
  {
    name: 'footnotes',
    syntax: ['footnotes="sticky"', 'footnotes="static"'],
    description:
      'Keeps the list of footnotes at the bottom of the window while the block is on screen, or not. It overrides the `footnotes.sticky` option for the block.',
    page: 'features/footnotes',
    example: {
      lang: 'js',
      meta: 'footnotes="sticky"',
      code: "// [!ref] The port that the server listens on.\nconst port = 8080\nconst host = 'localhost'",
    },
  },
  {
    name: 'startNoteNumber',
    syntax: ['startNoteNumber={N}'],
    description:
      'Numbers the annotations or footnotes of the block from `N`, not from 1, to continue the numbers of an earlier block.',
    page: 'features/annotations',
    example: {
      lang: 'js',
      meta: 'startNoteNumber={12}',
      code: 'const port = 8080 // [!annotate] The port that the server listens on.',
    },
  },
  {
    name: 'label',
    syntax: ['label="<text>"'],
    description:
      'Names a variant of a code switcher in its menu. It works only on a code block inside a `:::code-switcher` directive.',
    page: 'features/code-switcher',
  },
  {
    name: 'step',
    syntax: ['step="<text>"'],
    description:
      'Gives the label of a step in a `<CodeWalkthrough>` component. The title bar shows the label after the title.',
    page: 'features/code-walkthrough',
    example: {
      lang: 'js',
      meta: 'title="server.js" step="Create the app"',
      code: "import express from 'express';\n\nconst app = express();",
    },
  },
  {
    name: 'runnable',
    syntax: ['runnable'],
    description:
      'Adds a **Run in browser** button, which runs the code in the browser and shows the output under the block.',
    page: 'features/run-in-the-browser',
    example: { lang: 'py', meta: 'runnable', code: 'print(sum([1, 2, 3]))' },
  },
  {
    name: 'runnable.label',
    syntax: ['runnable.label="<text>"'],
    description:
      'The text of the button of a `runnable` block. It overrides the `runnable.label` option for the block.',
    page: 'features/run-in-the-browser',
    example: { lang: 'py', meta: 'runnable runnable.label="Try it"', code: 'print(sum([1, 2, 3]))' },
  },
  {
    name: 'runnable.againLabel',
    syntax: ['runnable.againLabel="<text>"'],
    description:
      'The text of the button after the first run. It overrides the `runnable.againLabel` option for the block.',
    page: 'features/run-in-the-browser',
  },
  {
    name: 'runnable.timeout',
    syntax: ['runnable.timeout=<ms>'],
    description: 'Milliseconds before a run stops. It overrides the `runnable.timeout` option for the block.',
    page: 'features/run-in-the-browser',
  },
  {
    name: 'focus.style',
    syntax: ['focus.style="blur"', 'focus.style="dim"'],
    description:
      'Blurs and fades the lines outside the focus, or only fades them. It overrides the `focus.style` option for the block.',
    page: 'features/focus',
    example: {
      lang: 'js',
      meta: 'focus={2} focus.style="dim"',
      code: "const host = 'localhost'\nconst port = 8080\nconst debug = false",
    },
  },
  {
    name: 'lineStates.prefix',
    syntax: ['lineStates.prefix=false', 'lineStates.prefix=true'],
    description:
      'Shows the name of the state before each message, or not. It overrides the `lineStates.prefix` option for the block.',
    page: 'features/line-states',
    example: {
      lang: 'js',
      meta: 'lineStates.prefix=false',
      code: 'const retries = -1 // [!code error] Must be 0 or more',
    },
  },
  {
    name: 'shellCopy.prompts',
    syntax: ['shellCopy.prompts="<text>"'],
    description:
      'A prompt that starts a command in a terminal block, such as `shellCopy.prompts="% "`. Repeat it for more prompts. It replaces the `shellCopy.prompts` option for the block.',
    page: 'features/smart-shell-copy',
    example: { lang: 'sh', meta: 'shellCopy.prompts="% "', code: '% npm run build\nBuilt in 2.1 s' },
  },
  {
    name: 'wordDiff.minSimilarity',
    syntax: ['wordDiff.minSimilarity=<0-1>'],
    description:
      'How similar a removed and an added line must be for word-level diff to compare them. It overrides the `wordDiff.minSimilarity` option for the block.',
    page: 'features/word-level-diff',
  },
  {
    name: 'footnotes.sticky',
    syntax: ['footnotes.sticky=false', 'footnotes.sticky=true'],
    description:
      'Keeps the list of footnotes in view while the block is on screen, or not. It overrides the `footnotes.sticky` option for the block.',
    page: 'features/footnotes',
  },
  noteStyleAttribute(
    'footnotes',
    'badges',
    'js',
    '// [!ref] Read from the environment.\nconst port = process.env.PORT',
    'filled',
  ),
  noteStyleAttribute('annotations', 'markers', 'js', 'const port = 8080 // [!annotate] The default port.', 'outline'),
  {
    name: 'expandable.lines',
    syntax: ['expandable.lines=<N>'],
    description:
      'The lines that the block shows before it expands, when it is expandable. It overrides the `expandable.lines` option for the block.',
    page: 'features/expandable-blocks',
  },
  {
    name: 'placeholders.storage',
    syntax: ['placeholders.storage="local"', 'placeholders.storage="session"', 'placeholders.storage="none"'],
    description:
      'Where the browser keeps the values that readers type into the fields of the block. It overrides the `placeholders.storage` option for the block.',
    page: 'features/fill-in-placeholders',
  },
];

export interface StyleSettingDoc {
  description: string;
  /** Required when the default is computed from other settings. Says how. */
  derived?: string;
}

export interface StyleGroupDoc {
  /** The feature page, or none for the shared group. */
  page?: string;
  /** Keys that start with `<state>` stand for one setting for each line state. */
  settings: Record<string, StyleSettingDoc>;
}

const accent = 'The value of `codeblocks.accent`.';
/** A theme colour, such as `terminal.ansiGreen`, lightened or darkened to `contrast` on the code background. */
const fromTheme = (colour: string, contrast: string) =>
  `The \`${colour}\` colour of the theme, with ${contrast} contrast on the code background.`;
const bracket = (depth: string, fallback: string) =>
  `The \`editorBracketHighlight.foreground${depth}\` colour of the theme, or VS Code's default (\`${fallback}\`) if the theme has none, with 4.5:1 contrast on the code background.`;

/** The `outline` note style settings, which annotations and footnotes share. */
const outlineSettings = (marker: string) => ({
  outlineAccent: {
    description: `With \`style: 'outline'\`: the border of a ${marker}, the bar of a lit line and the background of an active ${marker}.`,
    derived: fromTheme('terminal.ansiMagenta', '4.5:1'),
  },
  outlineNumberForeground: {
    description: `With \`style: 'outline'\`: the numbers. Needs 4.5:1 contrast on the code background.`,
    derived:
      '`outlineAccent` mixed 30% towards `codeForeground`, with 4.5:1 contrast on the code background and on `outlineLineBackground`.',
  },
  outlineActiveForeground: {
    description: `With \`style: 'outline'\`: the number of an active ${marker}, on an \`outlineAccent\` background.`,
    derived: 'The code background, with 4.5:1 contrast on `outlineAccent`.',
  },
  outlineLineBackground: {
    description: `With \`style: 'outline'\`: the tint of a lit line. Needs 4.5:1 contrast for every syntax colour.`,
    derived: '`outlineAccent` at 10% opacity, on the code background.',
  },
});

export const styleSettingsReference: Record<string, StyleGroupDoc> = {
  codeblocks: {
    settings: {
      accent: {
        description: 'Markers, numbered buttons and active states. Needs 3:1 contrast on the code background.',
        derived: fromTheme('terminal.ansiBlue', '4.5:1'),
      },
      accentHover: {
        description: 'Step borders under the mouse cursor.',
        derived: '`accent` mixed 45% towards `codeForeground`: lighter in dark themes, darker in light themes.',
      },
      accentForeground: {
        description: 'Text on an `accent` background.',
        derived: 'The code background, with 4.5:1 contrast on `accent`.',
      },
      mutedForeground: {
        description: 'Secondary text, such as output and marker labels. Needs 4.5:1 contrast on the code background.',
        derived:
          '`codeForeground` mixed 30% towards the code background, with 4.5:1 contrast on it, on `popoverBackground`, on a 10% tint of `codeForeground` and on the frame tab bar.',
      },
      focusRing: { description: 'The outline of a control that has keyboard focus.', derived: accent },
      popoverBackground: {
        description: 'The background of annotation notes and hover cards.',
        derived: 'The code background mixed 12% towards `accent` in dark themes, and lightened in light themes.',
      },
      popoverForeground: {
        description: 'The text of annotation notes and hover cards.',
        derived: '`codeForeground`, with 4.5:1 contrast on `popoverBackground`.',
      },
      popoverBorder: {
        description: 'The border of annotation notes and hover cards.',
        derived: '`popoverBackground` mixed 30% towards `accent`.',
      },
      popoverShadow: { description: 'The shadow of annotation notes and hover cards.' },
      popoverRadius: { description: 'The corner radius of annotation notes and hover cards.' },
      popoverMaxWidth: {
        description: 'The width of annotation notes. Hover cards are 20px wider. Both stay 12px inside the window.',
      },
      popoverFontSize: { description: 'The text size of annotation notes and hover cards.' },
    },
  },
  codeblocksFocus: {
    page: 'features/focus',
    settings: {
      blur: { description: 'The blur radius of lines outside the focus.' },
      opacity: { description: 'The opacity of lines outside the focus.' },
      transitionDuration: { description: 'The time that the lines take to become clear.' },
    },
  },
  codeblocksLineStates: {
    page: 'features/line-states',
    settings: {
      barWidth: { description: 'The width of the bar on the left edge of a line.' },
      labelFontSize: { description: 'The text size of messages.' },
      labelRadius: { description: 'The corner radius of messages.' },
      error: {
        description: 'The colour of the error state. The other error settings come from it.',
        derived: fromTheme('editorError.foreground', '3:1'),
      },
      warning: {
        description: 'The colour of the warning state. The other warning settings come from it.',
        derived: fromTheme('editorWarning.foreground', '3:1'),
      },
      info: {
        description: 'The colour of the info state. The other info settings come from it.',
        derived: fromTheme('editorInfo.foreground', '3:1'),
      },
      success: {
        description: 'The colour of the success state. The other success settings come from it.',
        derived: fromTheme('terminal.ansiGreen', '3:1'),
      },
      '<state>Background': {
        description: 'The tint of a line with the state. There is one for each state, such as `errorBackground`.',
        derived: 'The state colour at 15% opacity.',
      },
      '<state>LabelBackground': {
        description: 'The background of a message.',
        derived: 'The state colour at 20% opacity.',
      },
      '<state>LabelForeground': {
        description: 'The text of a message.',
        derived: 'The state colour mixed with the code colour, with 5:1 contrast on the message background.',
      },
      '<marker>LabelBackground': {
        description:
          'The background of a message after `[!code ++]`, `[!code --]` or `[!code highlight]`. There is one for each of `ins`, `del` and `mark`, such as `insLabelBackground`.',
        derived: "Expressive Code's `textMarkers.<marker>BorderColor` at 20% opacity.",
      },
      '<marker>LabelForeground': {
        description: 'The text of a message after `[!code ++]`, `[!code --]` or `[!code highlight]`.',
        derived: 'The marker colour mixed with the code colour, with 5:1 contrast on the message background.',
      },
    },
  },
  codeblocksWordDiff: {
    page: 'features/word-level-diff',
    settings: {
      ins: {
        description: 'The colour that the tint and the bar of added words come from.',
        derived: 'The `terminal.ansiGreen` colour of the theme.',
      },
      del: {
        description: 'The colour that the tint and the bar of removed words come from.',
        derived: 'The `terminal.ansiRed` colour of the theme.',
      },
      insBackground: {
        description: 'The tint of added words.',
        derived: '`ins` at 25% opacity on dark themes, 40% on light themes.',
      },
      delBackground: {
        description: 'The tint of removed words.',
        derived: '`del` at 25% opacity on dark themes, 40% on light themes.',
      },
    },
  },
  codeblocksBrackets: {
    page: 'features/colourised-brackets',
    settings: {
      colour1: {
        description: 'Brackets at the first depth, and at every third depth after it.',
        derived: bracket('1', '#ffd700` dark, `#0431fa` light'),
      },
      colour2: {
        description: 'Brackets at the second depth, and at every third depth after it.',
        derived: bracket('2', '#da70d6` dark, `#319331` light'),
      },
      colour3: {
        description: 'Brackets at the third depth, and at every third depth after it.',
        derived: bracket('3', '#179fff` dark, `#7b3814` light'),
      },
    },
  },
  codeblocksWhitespace: {
    page: 'features/visible-whitespace',
    settings: {
      foreground: {
        description: 'The colour of the glyphs.',
        derived: '`codeForeground` at 32% opacity in dark themes and 38% in light themes.',
      },
    },
  },
  codeblocksShellCopy: {
    page: 'features/smart-shell-copy',
    settings: {
      promptForeground: { description: 'The colour of prompts.', derived: fromTheme('terminal.ansiCyan', '4.5:1') },
      outputForeground: {
        description: 'The colour of output lines.',
        derived: 'The value of `codeblocks.mutedForeground`.',
      },
    },
  },
  codeblocksCodeLinks: {
    page: 'features/code-links',
    settings: {
      underline: {
        description: 'The underline of a link. Needs 3:1 contrast on the code background.',
        derived: accent,
      },
      hoverBackground: {
        description: 'The background of a link on hover and focus.',
        derived: '`codeblocks.accent` at 10% opacity in dark themes and 12% in light themes.',
      },
    },
  },
  codeblocksApiLinks: {
    page: 'features/api-auto-linking',
    settings: {
      underline: {
        description: 'The dotted underline of a link. Needs 3:1 contrast on the code background.',
        derived: '`codeForeground` mixed 45% towards the code background, with 3:1 contrast on it.',
      },
      hoverUnderline: { description: 'The solid underline of a link on hover and focus.', derived: accent },
      hoverBackground: {
        description: 'The background of a link on hover and focus.',
        derived: '`codeblocks.accent` at 10% opacity in dark themes and 12% in light themes.',
      },
    },
  },
  codeblocksMentions: {
    page: 'features/code-mentions',
    settings: {
      bar: { description: 'The bar on the left edge of a highlighted line.', derived: accent },
      background: {
        description: 'The tint of a highlighted line. Needs 4.5:1 contrast for every syntax colour.',
        derived: '`bar` at 10% opacity in dark themes and 12% in light themes.',
      },
      fadeOpacity: { description: 'The opacity of the other lines while lines are highlighted.' },
    },
  },
  codeblocksPermalinks: {
    page: 'features/line-permalinks',
    settings: {
      foreground: {
        description: 'The colour of the line numbers.',
        derived: 'The gutter colour of the theme, with 4.5:1 contrast on the code background.',
      },
      target: {
        description: 'The bar on the left edge of a highlighted line.',
        derived: fromTheme('terminal.ansiYellow', '3:1'),
      },
      targetBackground: {
        description: 'The tint of a highlighted line.',
        derived: '`target` at 6% opacity in dark themes and 12% in light themes.',
      },
    },
  },
  codeblocksHiddenLines: {
    page: 'features/hidden-lines',
    settings: {
      badgeBackground: {
        description: 'The background of the text on a marker.',
        derived: '`codeblocks.mutedForeground` at 10% opacity on the code background.',
      },
      rule: {
        description: 'The dashed rule of a marker.',
        derived: '`codeblocks.mutedForeground` at 35% opacity.',
      },
      ruleHover: {
        description: 'The dashed rule of a marker under the mouse cursor.',
        derived: 'The value of `codeblocks.mutedForeground`.',
      },
      ruleOpen: {
        description: 'The dashed rule of a marker while its lines show.',
        derived: '`codeblocks.mutedForeground` at 22% opacity.',
      },
      openBackground: {
        description: 'The tint of a hidden line that shows.',
        derived: '`codeForeground` at 4% opacity.',
      },
      openOpacity: { description: 'The opacity of the code of a hidden line that shows.' },
    },
  },
  codeblocksRunnable: {
    page: 'features/run-in-the-browser',
    settings: {
      outputForeground: {
        description: 'Standard output. Needs 4.5:1 contrast on the code background.',
        derived: fromTheme('terminal.ansiGreen', '4.5:1'),
      },
      errorForeground: {
        description: 'Standard error and run errors. Needs 4.5:1 contrast on the code background.',
        derived: fromTheme('terminal.ansiRed', '4.5:1'),
      },
    },
  },
  codeblocksWalkthrough: {
    page: 'features/code-walkthrough',
    settings: {
      stepBorder: {
        description: 'The border of a step that is not done yet.',
        derived: '`codeForeground` mixed 50% towards the code background, with 3:1 contrast on it.',
      },
      doneForeground: {
        description: 'The number of a step that is done.',
        derived: '`codeblocks.accent` mixed 50% towards `codeForeground`, with 4.5:1 contrast on the code background.',
      },
      line: {
        description: 'The line between two steps that are not done yet.',
        derived: 'The code background mixed 15% towards `codeForeground`.',
      },
      duration: { description: 'The time that the animation between two steps takes, in `ms` or `s`.' },
      newLineBackground: {
        description: 'The tint that flashes on a line that is new in a step, then fades out.',
        derived: 'The `terminal.ansiGreen` colour of the theme at 30% opacity.',
      },
      newLineDuration: { description: 'The time that the tint of a new line takes to fade out.' },
      themeIndex: {
        description: 'The index of the theme, which the animation reads to pick token colours. Do not change it.',
        derived: 'The index of the theme in the Expressive Code `themes` list.',
      },
    },
  },
  codeblocksCallouts: {
    page: 'features/inline-callouts',
    settings: {
      background: {
        description: 'The background of a bubble.',
        derived: 'The value of `codeblocks.popoverBackground`.',
      },
      foreground: { description: 'The text of a bubble.', derived: 'The value of `codeblocks.popoverForeground`.' },
      border: {
        description: 'The border and the arrow of a bubble.',
        derived: 'The value of `codeblocks.popoverBorder`.',
      },
      fontSize: { description: 'The text size of a bubble.' },
      radius: { description: 'The corner radius of a bubble.' },
    },
  },
  codeblocksAnnotations: {
    page: 'features/annotations',
    settings: {
      markerBackground: { description: 'The background of a numbered marker.', derived: accent },
      markerForeground: {
        description: 'The number on a marker.',
        derived: 'The value of `codeblocks.accentForeground`.',
      },
      markerHoverBackground: {
        description: 'The background of a marker under the mouse cursor, with keyboard focus or with its note open.',
        derived: '`markerBackground` mixed 45% towards `codeForeground`.',
      },
      markerSize: { description: 'The width and height of a marker.' },
      lineBackground: {
        description: 'The tint of the line of an open annotation. Needs 4.5:1 contrast for every syntax colour.',
        derived: '`codeblocks.accent` at 10% opacity in dark themes and 12% in light themes.',
      },
      ...outlineSettings('marker'),
    },
  },
  codeblocksFootnotes: {
    page: 'features/footnotes',
    settings: {
      accent: {
        description: 'The background of a badge and the bar of a selected line.',
        derived: accent,
      },
      numberForeground: {
        description: 'List numbers. Needs 4.5:1 contrast on the code background.',
        derived:
          '`accent` mixed 30% towards `codeForeground`, with 4.5:1 contrast on the code background and on `lineBackground`.',
      },
      activeForeground: {
        description: 'The number on a badge, on an `accent` background.',
        derived: 'The code background, with 4.5:1 contrast on `accent`.',
      },
      activeBackground: {
        description: 'The background of a badge under the mouse cursor, with keyboard focus or on a selected line.',
        derived: '`accent` mixed 45% towards `codeForeground`.',
      },
      lineBackground: {
        description: 'The tint of a selected line. Needs 4.5:1 contrast for every syntax colour.',
        derived: '`accent` at 10% opacity in dark themes and 12% in light themes, on the code background.',
      },
      ...outlineSettings('badge'),
      stickyShadow: { description: 'The shadow above a sticky list of footnotes.' },
    },
  },
};
