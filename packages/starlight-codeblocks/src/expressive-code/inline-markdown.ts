import { type ElementContent, h } from '@expressive-code/core/hast';

const TOKEN = /`([^`]+)`|\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
const SAFE_URL = /^(?:https?:\/\/|mailto:|[/#.?]|[\w-]+(?:[/#?.]|$))/i;

/**
 * Renders the text of a directive (a message, an annotation, a callout or a footnote).
 * Inline code, links and bold become HTML. Everything else stays text.
 */
export function inlineMarkdown(text: string): ElementContent[] {
  const nodes: ElementContent[] = [];
  let cursor = 0;
  for (const match of text.matchAll(TOKEN)) {
    const [raw, code, bold, label, href] = match;
    if (match.index > cursor) nodes.push({ type: 'text', value: text.slice(cursor, match.index) });
    if (code !== undefined) nodes.push(h('code', code));
    else if (bold !== undefined) nodes.push(h('strong', inlineMarkdown(bold)));
    else if (href && SAFE_URL.test(href)) nodes.push(h('a', { href }, inlineMarkdown(label ?? '')));
    else nodes.push({ type: 'text', value: raw });
    cursor = match.index + raw.length;
  }
  if (cursor < text.length) nodes.push({ type: 'text', value: text.slice(cursor) });
  return nodes;
}
