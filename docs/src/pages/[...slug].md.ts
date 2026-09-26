import { getCollection } from 'astro:content';
import type { APIRoute, GetStaticPaths } from 'astro';
import { pageMarkdown } from '../markdown.ts';

export const getStaticPaths = (async () =>
  (await getCollection('docs')).map((entry) => ({
    params: { slug: entry.id },
    props: { entry },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(pageMarkdown(props.entry), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
