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
    syntax: ['error={range}', 'warning={range}', 'info={range}'],
    description:
      'Marks the lines in the range with a line state. The attribute gives no message. Use a directive for a message.',
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
    syntax: ['brackets'],
    description:
      'Colours matching brackets by nesting depth. The `brackets.languages` option turns it on for whole languages.',
    page: 'features/colourised-brackets',
    example: { lang: 'js', meta: 'brackets', code: 'const total = items.map((item) => item.price * (1 + tax));' },
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
    name: 'expandable',
    syntax: ['expandable', 'expandable={N}'],
    description:
      'Shows the first lines of the block, with a button to show the rest. The flag shows the number of lines in the `expandable.lines` option. `{N}` shows `N` lines.',
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
    page: 'features/side-by-side-annotations',
    example: {
      lang: 'js',
      meta: 'annotations="side"',
      code: "const port = 8080 // [!annotate] The port that the server listens on.\nconst host = 'localhost'",
    },
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
      'Gives the label of a step in a `<CodeSteps>` component. The title bar shows the label after the title.',
    page: 'features/token-transitions',
    example: {
      lang: 'js',
      meta: 'title="server.js" step="Create the app"',
      code: "import express from 'express';\n\nconst app = express();",
    },
  },
  {
    name: 'runnable',
    syntax: ['runnable'],
    description: 'Adds a Run button, which runs the code in the browser and shows the output under the block.',
    page: 'features/run-in-the-browser',
    example: { lang: 'py', meta: 'runnable', code: 'print(sum([1, 2, 3]))' },
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

export const styleSettingsReference: Record<string, StyleGroupDoc> = {
  codeblocks: {
    settings: {
      accent: {
        description: 'Markers, numbered buttons and active states. Needs 3:1 contrast on the code background.',
      },
      accentForeground: { description: 'Text on an `accent` background.' },
      mutedForeground: {
        description: 'Secondary text, such as output and marker labels. Needs 4.5:1 contrast on the code background.',
      },
      focusRing: { description: 'The outline of a control that has keyboard focus.', derived: accent },
      popoverBackground: { description: 'The background of annotation notes and hover cards.' },
      popoverForeground: { description: 'The text of annotation notes and hover cards.' },
      popoverBorder: { description: 'The border of annotation notes and hover cards.' },
      popoverShadow: { description: 'The shadow of annotation notes and hover cards.' },
      popoverRadius: { description: 'The corner radius of annotation notes and hover cards.' },
      popoverMaxWidth: { description: 'The largest width of annotation notes and hover cards.' },
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
      error: { description: 'The colour of the error state. The other error settings come from it.' },
      warning: { description: 'The colour of the warning state. The other warning settings come from it.' },
      info: { description: 'The colour of the info state. The other info settings come from it.' },
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
    },
  },
  codeblocksWordDiff: {
    page: 'features/word-level-diff',
    settings: {
      ins: { description: 'The colour that the tint of added words comes from.' },
      del: { description: 'The colour that the tint of removed words comes from.' },
      insBackground: {
        description: 'The tint of added words.',
        derived: '`ins` at 60% opacity on dark themes, 75% on light themes.',
      },
      delBackground: {
        description: 'The tint of removed words.',
        derived: '`del` at 70% opacity on dark themes, 75% on light themes.',
      },
    },
  },
  codeblocksBrackets: {
    page: 'features/colourised-brackets',
    settings: {
      colour1: { description: 'Brackets at the first depth, and at every third depth after it.' },
      colour2: { description: 'Brackets at the second depth, and at every third depth after it.' },
      colour3: { description: 'Brackets at the third depth, and at every third depth after it.' },
    },
  },
  codeblocksShellCopy: {
    page: 'features/smart-shell-copy',
    settings: {
      promptForeground: { description: 'The colour of prompts.' },
      outputForeground: {
        description: 'The colour of output lines.',
        derived: 'The value of `codeblocks.mutedForeground`.',
      },
    },
  },
  codeblocksTokenLinks: {
    page: 'features/token-links',
    settings: {
      underline: {
        description: 'The underline of a link. Needs 3:1 contrast on the code background.',
        derived: accent,
      },
      hoverBackground: {
        description: 'The background of a link on hover and focus.',
        derived: '`codeblocks.accent` at 12% opacity.',
      },
    },
  },
  codeblocksApiLinks: {
    page: 'features/api-auto-linking',
    settings: {
      underline: { description: 'The dotted underline of a link. Needs 3:1 contrast on the code background.' },
      hoverUnderline: { description: 'The solid underline of a link on hover and focus.', derived: accent },
      hoverBackground: {
        description: 'The background of a link on hover and focus.',
        derived: '`codeblocks.accent` at 12% opacity.',
      },
    },
  },
  codeblocksMentions: {
    page: 'features/code-mentions',
    settings: {
      bar: { description: 'The bar on the left edge of a highlighted line.', derived: accent },
      background: { description: 'The tint of a highlighted line.', derived: '`bar` at 17% opacity.' },
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
      target: { description: 'The bar on the left edge of a highlighted line.' },
      targetBackground: { description: 'The tint of a highlighted line.', derived: '`target` at 16% opacity.' },
    },
  },
  codeblocksHiddenLines: {
    page: 'features/hidden-lines',
    settings: {
      badgeBackground: {
        description: 'The background of the text on a marker.',
        derived: '`codeblocks.mutedForeground` at 10% opacity on the code background.',
      },
    },
  },
  codeblocksRunnable: {
    page: 'features/run-in-the-browser',
    settings: {
      outputForeground: { description: 'Standard output. Needs 4.5:1 contrast on the code background.' },
      errorForeground: { description: 'Standard error and run errors. Needs 4.5:1 contrast on the code background.' },
    },
  },
  codeblocksTransitions: {
    page: 'features/token-transitions',
    settings: {
      stepBorder: { description: 'The border of a step that is not done yet.' },
      doneForeground: { description: 'The number of a step that is done.' },
      line: { description: 'The line between two steps that are not done yet.' },
      duration: { description: 'The time that the animation between two steps takes.' },
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
      markerSize: { description: 'The width and height of a marker.' },
    },
  },
  codeblocksFootnotes: {
    page: 'features/footnotes',
    settings: {
      accent: {
        description: 'The border of a badge, the bar of a selected line and the background of a selected badge.',
      },
      numberForeground: { description: 'Badge numbers and list numbers. Needs 4.5:1 contrast on the code background.' },
      activeForeground: { description: 'The number of a selected badge, on an `accent` background.' },
      lineBackground: {
        description: 'The tint of a selected line.',
        derived: '`accent` at 17% opacity on the code background.',
      },
      stickyShadow: { description: 'The shadow above a sticky list of footnotes.' },
    },
  },
};
