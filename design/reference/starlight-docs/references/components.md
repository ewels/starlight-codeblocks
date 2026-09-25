# Starlight built-in components

All import from `@astrojs/starlight/components` in `.mdx`. In `.mdoc` (Markdoc preset) they need no import and use `{% tag %}` syntax. In plain `.md` they are unavailable — only the Aside directive works there.

```mdx
import { Tabs, TabItem, Steps, FileTree, Card, CardGrid, LinkCard, LinkButton, Aside, Badge, Icon, Code } from '@astrojs/starlight/components';
```

Import only what the page uses.

## When not to use a component

Components cost the reader attention. Plain prose and plain Markdown are the default; a component should earn its place by doing something Markdown can't:

- A single link → a normal Markdown link, not `<LinkCard>`.
- Two paragraphs of related text → paragraphs, not `<Card>`.
- Essential information → body text. Not an aside. Asides are for genuinely parenthetical material; burying a requirement in a `:::tip` means readers skip it.
- A list of steps that aren't strictly sequential → an ordered or unordered list without `<Steps>`.

## Tabs

For equivalent alternatives where the reader only needs one branch — package managers, operating systems, languages.

```mdx
<Tabs syncKey="pkg">
  <TabItem label="npm" icon="seti:npm">
    ```sh
    npm install
    ```
  </TabItem>
  <TabItem label="pnpm">
    ```sh
    pnpm install
    ```
  </TabItem>
</Tabs>
```

- `<TabItem>` requires `label`. It throws at build time without one.
- `icon` on `<TabItem>` takes a Starlight built-in icon name only — arbitrary SVG isn't supported.
- `syncKey` on `<Tabs>` links tab groups so a choice made once applies everywhere with the same key, persisted via `localStorage`. **Labels must match exactly** across synced groups or syncing breaks silently.
- Use one consistent `syncKey` per axis across the whole site (e.g. `pkg`, `os`), not per page.

For package-manager command tabs, **write the `<Tabs syncKey="pkg">` by hand.** Don't add `starlight-package-managers`: it last shipped January 2026, declares only `@astrojs/starlight >=0.22.0`, and predates Astro 7. Four short fenced blocks in a Tabs group cost nothing and carry no dependency risk.

## Steps

Wraps an ordered list to render it as a visually connected sequence.

```mdx
<Steps>

1. Install the dependency:

   ```sh
   npm i thing
   ```

2. Add it to the config.

3. Restart the dev server.

</Steps>
```

Only an ordered list may be the direct child. Blank lines around the list are needed for the Markdown inside to be processed. Indent continuation content (code blocks, extra paragraphs) to align with the list item text.

## FileTree

Project layouts. Always this rather than an ASCII tree in a fenced block — it's collapsible and screen-reader friendly.

```mdx
<FileTree>

- astro.config.mjs
- ec.config.mjs
- src/
  - content/
    - docs/
      - index.mdx
      - guides/
        - **getting-started.mdx** the file being discussed
- package.json

</FileTree>
```

Conventions:
- Trailing `/` marks a directory.
- `**bold**` highlights a file worth the reader's attention.
- Text after a filename becomes a comment beside it.
- `…` or `...` as an entry stands in for unlisted files.
- Directories with no listed children render as collapsed/empty.

## Cards and grids

- `<Card title="..." icon="...">` — grouping short related content. `icon` optional.
- `<CardGrid>` — lays children side by side when there's room. `stagger` offsets the second column, which suits landing pages and looks odd elsewhere.
- `<LinkCard title="..." href="..." description="...">` — a prominent link. `title` and `href` required.

Wrap `<LinkCard>`s in `<CardGrid>` for a "where next" block at the foot of a page. Don't mix `<Card>` and `<LinkCard>` in one grid — the interaction affordance becomes ambiguous.

## LinkButton

A call to action, for one primary next step per page at most.

```mdx
<LinkButton href="/getting-started/" icon="right-arrow">Get started</LinkButton>
<LinkButton href="/reference/" variant="secondary">Reference</LinkButton>
```

`href` required. `variant`: `primary` (default), `secondary`, `minimal`. `icon` takes a built-in icon name; `iconPlacement` is `start` or `end`.

## Aside

The only component usable in plain `.md`, via directive syntax:

```md
:::note
Useful but non-essential context.
:::

:::caution[Custom title]
Something that can bite.
:::
```

Types: `note`, `tip`, `caution`, `danger`. Also takes `title` and `icon` (a `StarlightIcon` name). In MDX the component form `<Aside type="caution" title="...">` is equivalent — **use the directive**, which reads better in source and works in plain `.md` too. Leave `icon` alone; the defaults carry meaning readers already recognise.

Usage discipline (from the Astro docs style guide, worth adopting):
- Don't use an aside to introduce new essential information — that belongs in body text.
- Don't use one to remind readers of something already said.
- `tip` is not for required actions. If it's required, it isn't a tip.
- `caution` implies real risk; `danger` implies data loss or a security problem. Overuse trains readers to skip them.

There's a machine-readable reason too: `starlight-llms-txt` strips `note` and `tip` asides from `llms-small.txt` by default (keeping `caution` and `danger`). Anything parked in a note vanishes for small-context models. See `references/llm-friendly.md`.

## Badge

Inline status labels: `<Badge text="New" variant="tip" />`. Variants: `note`, `danger`, `success`, `caution`, `tip`, `default`. `size`: `small`, `medium`, `large`.

Useful in sidebar labels and headings for version markers ("since v2.1") and deprecation. Not useful sprinkled through prose.

## Icon

`<Icon name="star" color="var(--sl-color-text-accent)" size="2rem" class="..." />`

`name` must be a built-in Starlight icon. Icons are decorative by default; pass `label` to give one an accessible name when it carries meaning on its own.

Reference the CSS custom properties (`--sl-color-*`) rather than hard-coded colours so icons follow the theme in both light and dark modes.

## Code

The Expressive Code `<Code>` component, re-exported by Starlight. See `references/expressive-code.md` — particularly the `?raw` import pattern for pulling real source files into docs.

## Verification

- MDX throws at build on a missing import or a `<TabItem>` without `label`, so `npx astro build` catches most component mistakes.
- What it doesn't catch: mismatched `syncKey` labels, `<Steps>` around the wrong element type, and asides used where body text belongs. Those need a look at the page.

## Currency

Props here were verified against Starlight 0.41.7 upstream source in August 2026. They change between minors, and community themes add components with similar names. Run `./scripts/refresh.sh --docs` and read `/tmp/starlight-upstream/starlight/components/` rather than working around apparent discrepancies.
