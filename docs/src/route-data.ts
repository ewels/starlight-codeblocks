import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { componentHeadings } from './components/reference.ts';

export const onRequest = defineRouteMiddleware(({ locals }) => {
  const { entry, toc } = locals.starlightRoute;
  const headings = componentHeadings[entry.id];
  if (!headings || !toc) return;
  toc.items.push(...headings.map(({ slug, text }) => ({ depth: 2, slug, text, children: [] })));
});
