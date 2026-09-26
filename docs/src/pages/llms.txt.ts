import type { APIRoute } from 'astro';
import { entriesInOrder, pageUrl, siteUrl } from '../markdown.ts';

export const GET: APIRoute = async () => {
  const groups = await entriesInOrder();
  const index = groups.find((group) => group.entries.some((entry) => entry.id === 'index'))?.entries[0];
  const sections = groups.map(({ label, entries }) =>
    [
      `## ${label}\n`,
      ...entries.map(
        (entry) =>
          `- [${entry.id === 'index' ? 'Introduction' : entry.data.title}](${pageUrl(entry.id, true)}): ${entry.data.description ?? ''}`,
      ),
    ].join('\n'),
  );
  const text = [
    '# starlight-codeblocks',
    `> ${index?.data.description}`,
    `Each page below links to its Markdown version. Code blocks keep their fence lines, so the attributes and directives are as an author writes them. [llms-full.txt](${siteUrl}llms-full.txt) has every page in one file.`,
    ...sections,
  ].join('\n\n');
  return new Response(`${text}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
