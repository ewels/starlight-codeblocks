# Configuration

Docs: https://ewels.github.io/starlight-codeblocks/configuration/ and https://ewels.github.io/starlight-codeblocks/reference/options/

With no options, `codeblocks()` turns on every feature. Pages that use no interactive feature load no JavaScript from the plugin.

## Options

`codeblocks()` takes one object with a key for each feature. Set a key to `false` to turn the feature off, or to an object to change its settings. A feature with no settings takes only `false`: leave the key out to keep it on. An unknown key or a value of the wrong type stops the build with a message that names the option.

```js
codeblocks({
  focus: { style: 'dim' },
  expandable: { lines: 20 },
  runnable: false,
});
```

| Key | Settings | Feature |
|---|---|---|
| `focus` | `style`: `'blur'` or `'dim'`, default `'blur'` | Focus |
| `lineStates` | `states`: custom states by name, each `{ label, colour: { dark, light } }`. `prefix`: `false` leaves the name out of labels with a message | Line states |
| `notation` | `comments`: comment syntax for each language, added to the built-in map | Comment notation |
| `callouts` | None | Inline callouts |
| `annotations` | None | Annotations and side-by-side annotations |
| `footnotes` | `sticky`: default `false` | Footnotes |
| `hiddenLines` | None | Hidden lines |
| `shellCopy` | `prompts`: default `['$ ', '> ']`. Python `>>>` sessions need no prompt setting | Smart shell copy |
| `wordDiff` | `minSimilarity`: from 0 to 1, default `0.4` | Word-level diff |
| `whitespace` | None | Visible whitespace |
| `brackets` | `languages`: default `[]` | Colourised brackets |
| `codeLinks` | None | Code links |
| `apiLinks` | `adapters`: default `[python(), nextflow()]` | API auto-linking |
| `expandable` | `lines`: default `12`. `auto`: a line count, default `false` | Expandable blocks |
| `playgrounds` | Custom playgrounds by name | Open in playground |
| `mentions` | None | Code mentions |
| `permalinks` | None | Line permalinks |
| `placeholders` | `storage`: `'local'`, `'session'` or `'none'`, default `'local'` | Fill-in placeholders |
| `codeSwitcher` | None | Code switcher |
| `walkthrough` | None | Code walkthrough |
| `scrollycoding` | None | Scrollycoding |
| `inlineHighlighting` | `defaultLanguage`: default `false` | Inline code highlighting |
| `runnable` | `runtimes`: language to module path. `timeout`: default `10000` ms, at most `2147483647`. `label`: default `'Run in browser'`. `againLabel`: default `'Run again'` | Run in the browser |

### Options for one block

Put a setting on the fence line, with its name from `codeblocks()`, to change it for that block only. The fence line is the first line of the code block, with the language. The forms:

- `focus.style="dim"`
- `focus.style="blur"`
- `lineStates.prefix=false`
- `lineStates.prefix=true`
- `footnotes.sticky=false`
- `footnotes.sticky=true`
- `shellCopy.prompts="<text>"` (repeat it for more prompts)
- `wordDiff.minSimilarity=<0-1>`
- `expandable.lines=<N>`
- `placeholders.storage="local"`
- `placeholders.storage="session"`
- `placeholders.storage="none"`
- `runnable.label="<text>"`
- `runnable.againLabel="<text>"`
- `runnable.timeout=<ms>`

A bad value gives a build warning, and the block uses the site setting. Options for the whole site (states, comment syntaxes, adapters, playgrounds, runtimes) have no fence line form.

A directive of a feature that is off stays in the code, with a build warning. With `notation: false`, the plugin reads no directives, and every comment renders as written. Attributes still work.

`notation.comments` adds or replaces the comment syntax of a language. A syntax with a space in it is a block comment: the opener, then the closer. An empty list removes a language.

```js
codeblocks({
  notation: { comments: { cypher: ['//'], jinja: ['{# #}'] } },
});
```

## Colours and sizes

Every colour and size is an Expressive Code style setting. The default colours come from the site's Expressive Code theme (for example `terminal.ansiBlue` for `codeblocks.accent`), with contrast correction, so they follow any theme. Change them in `styleOverrides` of the Expressive Code options. A string applies to both themes. A pair gives the dark value, then the light value.

The shared settings are in the `codeblocks` group. Each feature has its own group, such as `codeblocksFocus`. The list: https://ewels.github.io/starlight-codeblocks/reference/style-settings/

```js
starlight({
  expressiveCode: {
    styleOverrides: {
      codeblocks: { accent: ['#c792ea', '#7c3aed'] },
    },
  },
  plugins: [codeblocks()],
});
```

The defaults meet WCAG 2.2 AA contrast. A new colour must keep the contrast that the style settings page gives for it.

## ec.config.mjs

If `ec.config.mjs` has no `plugins` list, the plugin needs no change. If it has a `plugins` list, Expressive Code uses only that list. Add `pluginCodeblocks()` to it:

```js
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { pluginCodeblocks } from 'starlight-codeblocks/expressive-code';

export default {
  plugins: [pluginCollapsibleSections(), pluginCodeblocks()],
};
```

Keep `codeblocks()` in `astro.config.mjs`, and give it all the options. `pluginCodeblocks()` with no argument reads the same options. `styleOverrides` can stay in `ec.config.mjs`. `pluginCodeblocks()` can go before or after most other plugins. `pluginCollapsibleSections()` must come before it, or the build stops.

## Other plugins

Docs: https://ewels.github.io/starlight-codeblocks/reference/plugin-compatibility/

- List `codeblocks()` before any plugin or theme that sets the Starlight `expressiveCode` option. If a theme must come first, set `expressiveCode: {}` in the Starlight config.
- `starlight-links-validator`: give it `exclude: linksValidatorExclude`, imported from `starlight-codeblocks`. It then skips `#mention:` links and links to a block `id`, such as `#cfg-L2`.
- `starlight-llms-txt`: add `customSelectors: { all: ['.scb-deco'] }`, so the labels, buttons and notes of the plugin stay out of the code in the text files.
- `starlight-versions` and `starlight-md-txt` read `.md` files as MDX. Put the `{:lang}` suffix of inline code highlighting inside the backticks.
- `expressive-code-twoslash` removes some lines. A directive on a removed line has no effect, with a warning.

## Markdown processors and file types

- Sätteri, the default Markdown processor of Astro 7, needs no set-up.
- With `markdown: { processor: unified() }`, every feature works. The plugin adds its own remark plugin. Keep Sätteri unless another plugin needs `unified()`.
- In Markdoc (`.mdoc`) files, give the fence line attributes in a `meta` attribute: `` ```js {% title="app.js" meta="focus={2}" %} ``. Directives work. The code switcher, inline code highlighting, the check of code mention links and the check for duplicate block ids do not run.
- The `<Code>` component of Starlight gets the features inside a block. Give attributes in its `meta` prop. The code switcher does not work around it.

## Sites without Starlight

An Astro site with Expressive Code and no Starlight gives the options to `pluginCodeblocks()` in `ec.config.mjs`:

```js
import { pluginCodeblocks } from 'starlight-codeblocks/expressive-code';

export default {
  plugins: [pluginCodeblocks({ focus: { style: 'dim' } })],
};
```

If the site has a `base`, give it as the second argument, `pluginCodeblocks(options, { base: '/docs' })`, so that links in code that start with `/` get it. The code switcher, inline code highlighting, `<CodeWalkthrough>` and `<Scrollycoding>` need Starlight. The features inside code blocks work on every site. Set `tabWidth: 0` in the Expressive Code options, so that tabs reach the code blocks unchanged.

`runnable.runtimes` values are then URLs that the browser imports as they are. There is no built-in Python runtime. Map `python` to the URL of the Pyodide runtime module, such as `https://cdn.jsdelivr.net/npm/starlight-codeblocks/dist/runtimes/pyodide.mjs`. The single plugins, such as `pluginFocus()`, are in https://ewels.github.io/starlight-codeblocks/reference/expressive-code-plugins/
