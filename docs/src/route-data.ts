import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { directives } from './components/directives.ts';

// The directive headings come from a component, so Starlight does not see them.
export const onRequest = defineRouteMiddleware(({ locals }) => {
  const { entry, toc } = locals.starlightRoute;
  if (entry.id !== 'reference/directives' || !toc) return;
  toc.items.push(...directives.map(({ id, label }) => ({ depth: 2, slug: id, text: label, children: [] })));
});
