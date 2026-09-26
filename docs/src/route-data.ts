import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { componentHeadings } from './components/reference.ts';

export const onRequest = defineRouteMiddleware(({ locals }) => {
  const { entry, toc } = locals.starlightRoute;
  const sections = componentHeadings[entry.id];
  if (!sections || !toc) return;
  for (const [parent, headings] of Object.entries(sections)) {
    const items = headings.map((heading) => ({ ...heading, children: [] }));
    if (parent === '') toc.items.push(...items);
    else toc.items.find((item) => item.slug === parent)?.children.unshift(...items);
  }
});
