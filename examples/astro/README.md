# Astro example

A minimal Astro site without Starlight. It adds the code block features with `codeblocks()` from `starlight-codeblocks/astro`, as [Astro setup](https://ewels.github.io/starlight-codeblocks/install/astro/) shows.

- `astro.config.mjs` has the set-up.
- `src/pages/index.mdx` has code blocks with some of the features, and a `<CodeWalkthrough>`.

From the root of the repository, build the package, then start the site:

```sh
pnpm install
pnpm build
pnpm --filter example-astro dev
```
