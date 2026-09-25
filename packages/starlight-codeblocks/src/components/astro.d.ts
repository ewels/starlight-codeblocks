// For `tsc`, which cannot read `.astro` files. Astro's own tools type them for sites.
declare module '*.astro' {
  const Component: (props: Record<string, unknown>) => unknown;
  export default Component;
}
