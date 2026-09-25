import { typescriptPlaygroundUrl } from './shared/typescript-playground.ts';

function update(block: Element) {
  const link = block.querySelector<HTMLAnchorElement>('a[data-scb-playground]');
  const code = block.querySelector<HTMLElement>('.copy button[data-code]')?.dataset.code;
  if (link && code !== undefined) link.href = typescriptPlaygroundUrl(code.replaceAll('\x7F', '\n'));
}

let listening = false;

/** Rebuilds TS Playground links from the copied text, which changes when readers fill in placeholders. */
export default function initPlayground() {
  for (const link of document.querySelectorAll('a[data-scb-playground]')) {
    const block = link.closest('[data-scb-placeholders]');
    if (block) update(block);
  }
  if (listening) return;
  listening = true;
  document.addEventListener('scb-placeholders-change', (event) => update(event.target as Element));
}
