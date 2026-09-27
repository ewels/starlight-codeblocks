# Link code

Three features add links to code blocks.

- If one piece of text needs a link that you choose, use a token link.
- If every library name in Python or Nextflow code needs a link to its reference, use API auto-linking. It starts on its own.
- If readers must share a link to one line or a range, use line permalinks.

## Token links

Docs: https://ewels.github.io/starlight-codeblocks/features/token-links/

Use for a one-off link from text in the code, or for a name that no API link adapter knows. The linked text keeps its syntax colours, with an underline in the accent colour.

| Syntax | Where |
|---|---|
| `[!link /<text>/ <url>]` | Comment on its own line, directly above the target line |

```py
# [!link /linspace/ https://numpy.org/doc/stable/reference/generated/numpy.linspace.html]
x = np.linspace(0, 1, 50)
```

- The plugin links the first match of the literal text on the line below. Make the text longer to match a later place.
- Stack several `[!link]` lines above one line to link several texts on it.
- A URL that starts with `/` is a link inside the site. The plugin adds Astro's `base`.
- If the text has no match, or the URL is missing, the build logs a warning.
- Names on the target line of a `[!link]` do not get API links, so a link is never inside another link.
- Option: `tokenLinks: false` turns the feature off. The directive then stays in the code, with a warning.
- Limits: a link cannot span two lines. JSON has no comments: use `jsonc`.

## API auto-linking

Docs: https://ewels.github.io/starlight-codeblocks/features/api-auto-linking/

API auto-linking finds library names in a block and links each one to its reference page. A card on hover or focus shows the signature or the kind, and a summary. You write nothing in the block. An adapter links a name only when it is certain about it.

| Syntax | Where |
|---|---|
| `apiLinks=false` | Fence line: turns the feature off for one block |

- The Python adapter runs on `py` and `python` blocks. It reads `import x`, `import x as y` and `from a import b as c`, then links the names that they bind and attribute chains on them, such as `os.path.join`.
- The Nextflow adapter runs on `nextflow` and `nf` blocks. It links channel factories, such as `channel.of`, and operators after them. With the `modules` option, it links processes and workflows from `include` statements.
- The build caches fetched indexes in `node_modules/.cache/starlight-codeblocks/`. A failed fetch logs a warning and does not fail the build.
- Option: `apiLinks.adapters` (default `[python(), nextflow()]`). A list replaces the default list, so give every adapter that you want:

  ```js
  import codeblocks from 'starlight-codeblocks';
  import { nextflow } from 'starlight-codeblocks/adapters/nextflow';
  import { python } from 'starlight-codeblocks/adapters/python';

  codeblocks({
    apiLinks: {
      adapters: [python({ inventories: ['https://numpy.org/doc/stable/objects.inv'] }), nextflow()],
    },
  });
  ```

- Python adapter options: `stdlib` (default `true`), `inventories` (Sphinx `objects.inv` URLs) and `pydocs` (packages that the site documents with starlight-pydocs, with the same `base`).
- Nextflow adapter option: `modules`, a function of `{ name, path }` that returns a URL, an object with `href`, or `undefined`.
- Another language needs an adapter of your own: https://ewels.github.io/starlight-codeblocks/extend/write-an-api-link-adapter/
- Limits: the Python adapter does not follow assignments and does not link built-ins such as `print`. A name that the block binds again does not link.

## Line permalinks

Docs: https://ewels.github.io/starlight-codeblocks/features/line-permalinks/

Use when readers must link to exact lines, for example to ask about one setting. The `id` gives the block line numbers, and each number is a link to its line. Do not use to highlight lines for the reader: use focus, line states or code mentions.

| Syntax | Where |
|---|---|
| `id="<id>"` | Fence line |

- Each number links to `#<id>-L<n>`. Shift and a second number link a range, `#<id>-L<a>-L<b>`. `#<id>` links to the whole block.
- Pick an `id` from the content, such as the file name. It must be unique on the page, and must not match a heading id such as `options`. A duplicate gives a build warning.
- `startLineNumber` of Expressive Code sets the first number.
- A link to a hidden line opens its marker. A link to a collapsed line opens an expandable block.
- `starlight-links-validator` reports these links as broken. Give it `exclude: linksValidatorExclude`.
- Option: `permalinks: false` ignores `id`.
- Limits: the line numbers take space, so long lines scroll sooner on phones. The page highlights one range at a time.
