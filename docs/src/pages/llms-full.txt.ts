import type { APIRoute } from 'astro';
import { entriesInOrder, pageMarkdown, pageUrl } from '../markdown.ts';

export const GET: APIRoute = async () => {
  const pages = (await entriesInOrder()).flatMap(({ entries }) =>
    entries.map((entry) => `<!-- ${pageUrl(entry.id)} -->\n\n${pageMarkdown(entry)}`),
  );
  return new Response(pages.join('\n---\n\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
